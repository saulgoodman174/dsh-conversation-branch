import { build, context } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
await mkdir('lib', { recursive: true });
const common = { bundle:true, logLevel:'info' };
const configs = [
  { ...common, entryPoints:['src/index.ts'], outfile:'lib/index.js', platform:'node', format:'esm', target:'node22', packages:'external' },
  { ...common, entryPoints:['src/client/index.tsx'], outfile:'lib/client.js', platform:'browser', format:'cjs', target:'es2022',
    external:['react','react/jsx-runtime'], jsx:'automatic',
    banner:{js:'window.__ModuleLoader__.load({id:"dsh-conversation-branch",factory:(require)=>{var module={exports:{}};var exports=module.exports;'},
    footer:{js:'return module.exports;}});'} }
];
execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--declaration','--emitDeclarationOnly','--outDir','lib/types','--rootDir','src'],{stdio:'inherit'});
for (const config of configs) {
  if (process.argv.includes('--watch')) await (await context(config)).watch();
  else await build(config);
}
