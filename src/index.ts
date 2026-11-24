import {methods,type Host,type ConfigValues} from './types';
import {RewindService,config} from './service';
import {record,RewindError,fail} from './errors';
export const name='dsh-conversation-branch';
export const inject=['connection','sessions','sessionQuery','workspaceRegistry','sessionController'];
// rc.3: remote.rewind without injection throws; requiring it before $mount leaves the client pending.
// The connection registry owns browser authentication, origin checks and owner admission for these routes.
export function apply(ctx:Host,options:Partial<ConfigValues>={}){
  const service=new RewindService(ctx,config(options));
  for(const method of methods) ctx.connection.fetch.register({
    path:'/api/'+name+'/'+method,methods:['POST'],requestBody:'buffered',
    async fetch(request){
      try {
        const input:unknown=await request.json().catch(()=>fail('bad-request','Invalid JSON.'));
        if(!input||typeof input!=='object'||Array.isArray(input)) fail('bad-request','Expected a JSON object.');
        const value=await service[method](record(input));
        return Response.json({ok:true,value});
      }catch(e){
        const error=e instanceof RewindError?e:new RewindError(record(e).code==='session/migration-required'?'rewind/migration-required':'rewind/internal',e instanceof Error?e.message:'Operation failed.');
        return Response.json({ok:false,error:{code:error.code,message:error.message,details:error.details}});
      }
    }
  });
}
