import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('../../',import.meta.url)),home=process.env.DSH_HOME;
if(!home||path.basename(home)!=='.pkgtest-home')throw Error('Use an isolated .pkgtest-home');
const profile=path.join(home,'profiles/pkgtest');
const manifestPath=path.join(profile,'package.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
if(manifest.name!=='dsh-profile-pkgtest')throw Error('Expected pkgtest');
const plugin='dsh-conversation-branch',fixture='rewind-pkgtest-fixture';
manifest.dsh.profile.bundles=manifest.dsh.profile.bundles.filter(n=>n!=='dsh-rewind-rpc-spike');
delete manifest.dependencies['dsh-rewind-rpc-spike'];
for(const name of [plugin,fixture]){
  const dest=path.join(profile,'node_modules',name);
  await mkdir(dest,{recursive:true});
  if(name===plugin){
    for(const file of ['package.json','cordis.patch.yml','lib','locale','icon.svg'])await cp(path.join(repo,file),path.join(dest,file),{recursive:true});
  }else{
    for(const file of ['host.mjs','client.js'])await cp(new URL(file,import.meta.url),path.join(dest,file));
    await writeFile(path.join(dest,'package.json'),JSON.stringify({name,version:'0.1.0',type:'module',exports:{'.':'./host.mjs','./client':'./client.js','./package.json':'./package.json'},dsh:{bundle:{patch:'./patch.yml'},client:{platform:'web',inject:['@deepseek-ai/dsh-client-ui-workspace']}}}));
    await writeFile(path.join(dest,'patch.yml'),'- insert:\n    - id: '+name+'\n      name: '+name+'\n');
  }
  manifest.dependencies[name]='0.1.0';
  if(!manifest.dsh.profile.bundles.includes(name))manifest.dsh.profile.bundles.push(name);
}
await writeFile(manifestPath,JSON.stringify(manifest,null,2));
