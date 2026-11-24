import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import type {Host,Timeline,ConfigValues} from './types';
import {methods} from './types';
import {fail,record} from './errors';
import {readItems} from './timeline';
import {seedText} from './export-text';
export const defaults:ConfigValues={maxItemChars:8000,maxExportChars:30000,prefillAfterBranch:true,exportTitlePrefix:'片段导出 · ',includeToolSummary:false};
export function config(input:Partial<ConfigValues>={}):ConfigValues {
  const value={...defaults};
  for(const [key,upper] of [['maxItemChars',20000],['maxExportChars',200000]] as const){
    const n=input[key];
    if(typeof n==='number' && Number.isSafeInteger(n)&&n>0&&n<=upper) value[key]=n;
    else if(n!==undefined) console.warn('[dsh-conversation-branch] Invalid '+key);
  }
  for(const key of ['prefillAfterBranch','includeToolSummary'] as const) if(typeof input[key]==='boolean') value[key]=input[key];
  if(typeof input.exportTitlePrefix==='string') value.exportTitlePrefix=input.exportTitlePrefix;
  return value;
}
type Args=Record<string,unknown>;
export class RewindService {
  constructor(private host:Host,private options:ConfigValues=defaults){}
  async capabilities(_args:Args){return {apiVersion:1,pluginVersion:'0.1.0',methods:[...methods]}}
  async timeline(args:Args):Promise<Timeline>{
    const id=args.sessionId;
    if(typeof id!=='string'||!id.trim()||id.length>200) fail('bad-request','Invalid sessionId.');
    let lease;
    try {lease=await this.host.sessionQuery.observeSession(id)} catch(e) {
      if(record(e).code==='SESSION_QUERY_SESSION_NOT_FOUND') fail('not-found','Session does not exist.',{sessionId:id});
      fail('not-found','Cannot open the source session.',{sessionId:id});
    }
    try {
      if(lease.header.id!==id) fail('not-found','Session identity mismatch.');
      const en=args.language==='en';
      const title=await this.host.sessionQuery.readTitle(id).catch(()=>undefined);
      const workspace=this.host.workspaceRegistry.list().find(w=>w.sessionIds.includes(id));
      const items=readItems(lease.events,this.options.maxItemChars,typeof args.includeToolSummary==='boolean'?args.includeToolSummary:this.options.includeToolSummary,en);
      return {sessionId:id,title:(typeof title==='string'?title:title?.title)||(en?'(Untitled session)':'(未命名会话)'),cwd:lease.header.cwd??'',
        ...(workspace?{workspaceId:workspace.id}:{}),items,totalMessages:items.length,latestSeq:lease.events.at(-1)?.seq??-1,inherited:lease.header.isSeeded};
    } finally {lease[Symbol.dispose]()}
  }
  async branch(args:Args){
    const {atSeq,messageId}=args;
    if((atSeq!==undefined)===(messageId!==undefined) || (atSeq!==undefined && (typeof atSeq!=='number'||!Number.isSafeInteger(atSeq)||atSeq<0)) ||
      (messageId!==undefined&&(typeof messageId!=='string'||!messageId.trim()))) fail('bad-request','Supply exactly one valid message selector.');
    const source=await this.timeline(args);
    const index=source.items.findIndex(i=>atSeq!==undefined?i.seq===atSeq:i.messageId===messageId);
    if(index<0) fail('unsupported','Select a visible conversation message.');
    const anchor=source.items.slice(0,index+1).findLast(i=>i.role==='user');
    if(!anchor) fail('no-anchor','No preceding user message.');
    const boundarySeq=anchor.seq-1;
    if(boundarySeq<0) fail('bad-request','No earlier event to fork.');
    const child=await this.host.sessionController.fork({sessionId:source.sessionId,atSeq:boundarySeq});
    return {...child,sourceSeq:source.items[index].seq,anchorSeq:anchor.seq,boundarySeq,prefill:this.options.prefillAfterBranch?anchor.text:''};
  }
  async exportSegment(args:Args){
    const seqs=args.seqs;
    if(!Array.isArray(seqs)||seqs.length>2000||seqs.some(s=>!Number.isSafeInteger(s)||s<0)) fail('bad-request','Invalid selection.');
    if(!seqs.length) fail('export-empty','Select at least one message.');
    if(args.title!==undefined && typeof args.title!=='string') fail('bad-request','Invalid title.');
    const source=await this.timeline(args);
    const selected=new Set(seqs);
    const items=source.items.filter(i=>selected.has(i.seq));
    if(!items.length) fail('export-empty','No selected messages are available.');
    const english=args.language==='en';
    const text=seedText(source,items,Date.now(),english);
    if(text.length>this.options.maxExportChars) fail('export-too-large','Select fewer messages.',{actualChars:text.length,maxChars:this.options.maxExportChars});
    const {sessionId}=await this.host.sessionController.create(source.workspaceId?{workspaceId:source.workspaceId}:{cwd:source.cwd});
    let session=this.host.sessions.get(sessionId);
    for(let i=0;i<80 && !session;i++){await delay(25);session=this.host.sessions.get(sessionId)}
    if(!session) fail('session-not-live','Created session is unavailable.',{sessionId});
    const event=session.append('user/message',{id:randomUUID(),role:'user',content:[{type:'text',text}],source:{kind:'user',rpcId:randomUUID(),clientTimeZone:'UTC'}},{surfaceOp:'append'});
    const flushed=await this.host.sessions.flush(session).catch(()=>false);
    if(flushed!==true) fail('durability-failed','Could not confirm persistence.',{sessionId,seq:event.seq});
    const prefix=english && this.options.exportTitlePrefix===defaults.exportTitlePrefix?'Excerpt · ':this.options.exportTitlePrefix;
    const title=(args.title?.trim()||prefix+source.title).slice(0,120);
    await this.host.sessionController.rename({sessionId,title}).catch(()=>console.warn('[dsh-conversation-branch] Could not rename exported session'));
    return {sessionId,title,messageCount:items.length,chars:text.length,truncated:items.some(i=>i.truncated),seedSeq:event.seq};
  }
}
