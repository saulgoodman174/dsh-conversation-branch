import type {Method,Timeline} from '../types';
type Problem={code:string;message:string};
interface State {sessionId:string|null; focus:string|null; data:Timeline|null;error:Problem|null;busy:boolean;created:string|null}
const blank:State={sessionId:null,focus:null,data:null,error:null,busy:false,created:null};
async function call<T>(method:Method,args:object):Promise<T>{
  const url=new URL('api/dsh-conversation-branch/'+method,document.baseURI);
  const r=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});
  if(!r.ok) throw {code:'rewind/transport',message:'HTTP '+r.status};
  const result=await r.json();
  if(!result.ok) throw result.error;
  return result.value;
}
export function panelStore(navigate:(id:string)=>boolean){
  let state=blank, serial=0;
  const listeners=new Set<()=>void>(), drafts=new Map<string,string>();
  function update(delta:Partial<State>){state={...state,...delta};listeners.forEach(f=>f())}
  function problem(e:unknown){const err=e as Partial<Problem>;return {code:err?.code||'rewind/transport',message:err?.message||String(e)}}
  return {
    subscribe:(f:()=>void)=>{listeners.add(f);return ()=>{listeners.delete(f)}},
    snapshot:()=>state,drafts,
    close(){serial++;update(blank)},
    async open(sessionId:string,language:string,focus:string|null=null){
      const token=++serial; update({...blank,sessionId,focus});
      try{const data=await call<Timeline>('timeline',{sessionId,language});if(token===serial)update({data})}
      catch(e){if(token===serial)update({error:problem(e)})}
    },
    async act(method:'branch'|'exportSegment',args:object,language:string){
      if(!state.sessionId||state.busy)return;
      const token=serial; update({busy:true,error:null});
      try{
        const child=await call<{sessionId:string;prefill?:string}>(method,{...args,sessionId:state.sessionId,language});
        if(token!==serial)return;
        if(child.prefill)drafts.set(child.sessionId,child.prefill);
        if(navigate(child.sessionId)){serial++;update(blank)}else update({created:child.sessionId,busy:false});
      }catch(e){if(token===serial)update({error:problem(e),busy:false})}
    }
  };
}
export type Store=ReturnType<typeof panelStore>;
