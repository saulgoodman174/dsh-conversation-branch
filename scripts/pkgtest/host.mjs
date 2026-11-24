// Test fixture only, installed in an isolated home. Never shipped by npm pack.
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export const name='rewind-pkgtest-fixture';
export const inject=['connection','sessions','sessionController','sessionQuery','workspaceRegistry'];
export function apply(ctx){
  if(path.basename(process.env.DSH_HOME||'')!=='.pkgtest-home') throw Error('Fixture requires .pkgtest-home');
  ctx.connection.fetch.register({path:'/api/rewind-fixture',methods:['POST'],requestBody:'buffered',async fetch(request){
    try {
    const {action,id,large}=await request.json();
    if(action==='seed'){
      const dir=path.join(process.env.DSH_HOME,'test-project');
      await (await import('node:fs/promises')).mkdir(dir,{recursive:true});
      const workspace=ctx.workspaceRegistry.list().find(w=>w.path===dir) || await ctx.workspaceRegistry.create(dir);
      const {sessionId}=await ctx.sessionController.create({workspaceId:workspace.id});
      const s=ctx.sessions.get(sessionId);
      for(let turn=0;turn<3;turn++){
        const user={id:randomUUID(),role:'user',content:[{type:'text',text:large?'Q'.repeat(8000):'Question '+turn}],source:{kind:'user',rpcId:randomUUID()}};
        s.append('user/message',user,{surfaceOp:'append'});
        s.append('turn/start',{turn});s.append('step/start',{turn,step:0});
        const message={id:randomUUID(),role:'assistant',content:[{type:'text',text:large?'A'.repeat(8000):'Answer '+turn}],source:{kind:'model',provider:'fixture',model:'test'}};
        s.append('assistant/message',{turn,step:0,message,stream:[]},{surfaceOp:'append'});
        s.append('step/end',{turn,step:0});s.append('turn/end',{turn,reason:{kind:'completed'}});
      }
      await ctx.sessions.flush(s);
      return Response.json({sessionId});
    }
    if(action==='inspect'){
      const s=ctx.sessions.get(id);
      if(!s) throw Error('Expected live session: '+id);
      const lease=await ctx.sessionQuery.observeSession(id);
      try{
        const events=lease.events;
        return Response.json({history:s.deriveMessages(),log:events,events:events.filter(e=>e.surfaceOp==='append'&&['user/message','assistant/message'].includes(e.type)),parent:lease.header.parentSession,inherited:lease.inheritedEventCount});
      }finally{lease[Symbol.dispose]()}
    }
    return Response.json({ok:false,error:{message:'Unknown fixture action'}},{status:400});
    } catch(error){return Response.json({ok:false,error:{code:error.code??'fixture/error',message:String(error)}},{status:500})}
  }});
}
