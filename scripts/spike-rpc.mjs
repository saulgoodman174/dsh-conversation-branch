import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Run after initializing a disposable pkgtest from the shipped web template.
if (!process.env.DSH_HOME) throw new Error('Set DSH_HOME to the disposable test home');
const profile = path.resolve(process.env.DSH_HOME, 'profiles/pkgtest');
const manifestPath = path.join(profile, 'package.json');
const profileManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (profileManifest.name !== 'dsh-profile-pkgtest') throw new Error('Expected pkgtest profile');
const name = 'dsh-rewind-rpc-spike';
const dir = path.join(profile, 'node_modules', name);
await mkdir(dir, { recursive: true });
const contract = `
const name = 'dsh-rewind-rpc-spike';
const codec = (type, parse) => ({ mode: 'strict', typeSymbol: name + '#' + type, create: () => ({ parse }) });
const args = codec('Args', v => {
  if (!v || typeof v.nonce !== 'string') throw new Error('Expected string nonce');
  return { nonce: v.nonce };
});
const result = codec('Result', v => {
  if (!v || v.apiVersion !== 1 || typeof v.nonce !== 'string') throw new Error('Invalid capabilities result');
  return v;
});
const descriptors = [{ id: name + '#rewind/capabilities', service: 'rewind', namespace: 'rewind',
  method: 'capabilities', invocation: { kind: 'direct' }, result,
  parameters: [{ name: 'args', wire: 'args', source: 'json', codec: args }] }];`;
const host = contract + `
export { name };
export const inject = ['typert'];
export function apply(ctx) {
  class Probe {
    typertRemote = Object.freeze({ service: this, serviceKey: 'rewind', namespace: 'rewind' });
    capabilities({ nonce }) { return { apiVersion: 1, nonce }; }
  }
  ctx.provide('rewind', new Probe());
  ctx.typert.register({ package: name, face: 'host', schemas: [],
    model: { services: [], events: [], objects: [] }, invocations: descriptors });
  console.log('[rewind-spike] host registered');
}`;
const client = `window.__ModuleLoader__.load({ id: '${name}', factory: require => {
${contract}
return { name, inject: ['slots', 'locale', 'remote', 'remote.rewind'], async apply(ctx) {
  const React = require('react');
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions', id: name
  }, () => React.createElement('button', { type: 'button' }, 'Rewind RPC probe')));
  try {
    await ctx.remote.$mount({ package: name, descriptors });
    const nonce = crypto.randomUUID();
    const response = await ctx.remote.rewind.capabilities({ nonce });
    const pass = response.ok && response.value.apiVersion === 1 && response.value.nonce === nonce;
    console.log('[rewind-spike]', JSON.stringify({ pass, nonce, response }));
  } catch (error) {
    console.error('[rewind-spike]', JSON.stringify({ code: error?.code, message: String(error), details: error?.details }));
  }
} };
}});`;
const http = process.argv.includes('--http');
const checkCreate = process.argv.includes('--check-create');
const endpoint = '/api/dsh-conversation-branch/capabilities';
const httpHost = contract + `
export { name };
export const inject = ${JSON.stringify(checkCreate ? ['connection', 'sessionController', 'sessions'] : ['connection'])};
export function apply(ctx) {
  ctx.connection.fetch.register({ path: ${JSON.stringify(endpoint)}, methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      const { nonce } = args.create().parse(await request.json());
      ${checkCreate ? `try {
        const { sessionId } = await ctx.sessionController.create({ cwd: process.env.DSH_HOME });
        const session = ctx.sessions.get(sessionId);
        const before = session.snapshotEvents().map(({seq, type}) => ({seq, type}));
        const event = session.append('user/message', { role:'user', id:crypto.randomUUID(),
          content:[{type:'text', text:'pkgtest seed'}], source:{kind:'user',rpcId:crypto.randomUUID(),clientTimeZone:'UTC'}
        }, {surfaceOp:'append'});
        const flushed = await ctx.sessions.flush(session);
        return Response.json({ok:true, value:{apiVersion:1,nonce,before,userSeq:event.seq,flushed}});
      } catch(e) { return Response.json({ok:false,error:{code:e.code,message:String(e)}}); }` : ''}
      return Response.json({ ok: true, value: result.create().parse({ apiVersion: 1, nonce }) });
    }
  });
}`;
const httpClient = client.replace("await ctx.remote.$mount({ package: name, descriptors });", "")
  .replace("await ctx.remote.rewind.capabilities({ nonce })", `await fetch(new URL('${endpoint.slice(1)}', document.baseURI), {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nonce })
  }).then(r => r.json())`);
const pkg = { name, version: '0.0.0', private: true, type: 'module', main: './host.js',
  exports: { '.': './host.js', './client': './client.js', './package.json': './package.json' },
  dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web', inject: [
    '@deepseek-ai/dsh-api-gateway', '@deepseek-ai/dsh-client-locale', '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-conversation'
  ] } } };
for (const [file, body] of Object.entries({ 'host.js': http ? httpHost : host, 'client.js': http ? httpClient : client,
  'package.json': JSON.stringify(pkg, null, 2), 'cordis.patch.yml': '- insert:\n    - id: ' + name + '\n      name: ' + name + '\n' })) {
  await writeFile(path.join(dir, file), body);
}
const bundles = profileManifest.dsh.profile.bundles;
if (!bundles.includes(name)) bundles.push(name);
profileManifest.dependencies[name] = '0.0.0';
await writeFile(manifestPath, JSON.stringify(profileManifest, null, 2) + '\n');
console.log('Prepared', dir);
