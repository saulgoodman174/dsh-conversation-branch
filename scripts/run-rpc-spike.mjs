import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';

if (!process.env.DSH_HOME || !process.env.DSH_APP || !process.env.PLAYWRIGHT_CORE) {
  throw new Error('Set DSH_HOME, DSH_APP (desktop installation directory) and PLAYWRIGHT_CORE');
}
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE);
const app = process.env.DSH_APP;
const server = spawn(path.join(app, 'DeepSeek Harness.exe'), ['--expose-internals',
  path.join(app, 'resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js'),
  '--profile', 'pkgtest', '--host', '127.0.0.1', '--port', '0', '--no-open'],
  { windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
const lines = [];
const record = value => { lines.push(value); console.log(value); };
let browser, page;
try {
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for pkgtest URL')), 30000);
    let output = '';
    const onOutput = data => {
      output += data;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s\x1b]+(?=\s)/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    };
    server.stdout.on('data', onOutput);
    server.stderr.on('data', onOutput);
    server.once('exit', code => { clearTimeout(timeout); reject(new Error('Host exited ' + code)); });
    server.once('error', reject);
  });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  page = await browser.newPage();
  page.on('pageerror', e => record('pageerror: ' + e.message));
  if(process.argv.includes('--e2e')) { await (await import('./pkgtest/scenario.mjs')).scenario(page,url,record); } else {
  const response = page.waitForEvent('console', {
    predicate: msg => msg.text().startsWith('[rewind-spike]'), timeout: 45000,
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  let message;
  try { message = await response; } catch (err) {
    record('Visible page: ' + (await page.locator('body').innerText()).slice(0, 900));
    throw err;
  }
  const raw = message.text().slice('[rewind-spike]'.length).trim();
  record(raw);
  if (JSON.parse(raw).pass !== true) throw new Error('RPC probe did not pass');
  if (process.argv.includes('--check-create') && JSON.parse(raw).response.value.userSeq !== JSON.parse(raw).response.value.before.length)
    throw new Error('Unexpected append sequence');
  }
} catch (err) {
  if(page && process.argv.includes('--e2e')) record('Visible UI: '+(await page.locator('body').innerText().catch(()=> '')).slice(-1800));
  record('FAIL: ' + err.message.replace(/token=[^\s]+/g, 'token=[redacted]'));
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    const closed = once(server, 'exit');
    server.kill();
    await closed;
  }
  const file = process.argv.includes('--e2e') ? 'pkgtest-e2e.output.txt' : process.argv.includes('--check-create') ? 'spike-create.output.txt'
    : process.argv.includes('--http') ? 'spike-http.output.txt' : 'spike-rpc-inject.output.txt';
  await writeFile(new URL(file, import.meta.url), lines.join('\n') + '\n');
}
