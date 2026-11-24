export type Role = 'user'|'assistant';
export interface Item {seq:number; messageId:string; role:Role; text:string; truncated:boolean; time:number; turn?:number; step?:number}
export interface Timeline {sessionId:string; title:string; cwd:string; workspaceId?:string; items:Item[]; totalMessages:number; latestSeq:number; inherited:boolean}
export interface LogEvent {seq:number; type:string; time:number; surfaceOp?:unknown; data:unknown}
export interface Host {
  sessionQuery:{observeSession(id:string):Promise<{header:{id:string;cwd?:string;isSeeded:boolean};events:readonly LogEvent[];[Symbol.dispose]():void}>;readTitle(id:string):Promise<{title:string}|string|undefined>};
  workspaceRegistry:{list():{id:string;sessionIds:readonly string[]}[]};
  sessionController:{create(args:{workspaceId:string}|{cwd:string}):Promise<{sessionId:string}>;fork(args:{sessionId:string;atSeq:number}):Promise<{sessionId:string}>;rename(args:{sessionId:string;title:string}):Promise<unknown>};
  sessions:{get(id:string):Live|undefined;flush(session:Live):Promise<boolean>};
  connection:{fetch:{register(route:{path:string;methods:string[];requestBody:'buffered';fetch(request:Request):Promise<Response>}):unknown}};
}
export interface Live {append(type:'user/message',data:unknown,opts:{surfaceOp:'append'}):{seq:number}}
export interface ConfigValues {maxItemChars:number;maxExportChars:number;prefillAfterBranch:boolean;exportTitlePrefix:string;includeToolSummary:boolean}
export const methods = ['capabilities','timeline','branch','exportSegment'] as const;
export type Method = typeof methods[number];
