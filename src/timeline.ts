import type {Item,LogEvent} from './types';
import {record} from './errors';
export function readItems(events:readonly LogEvent[],limit:number,tools:boolean,english=false):Item[] {
  const items:Item[]=[];
  for(const event of events) {
    if(event.surfaceOp!=='append' || !['user/message','assistant/message'].includes(event.type)) continue;
    const data=record(event.data);
    const role=event.type==='user/message'?'user':'assistant';
    const msg=role==='user'?data:record(data.message);
    if(record(msg.source).kind==='compact-checkpoint'||typeof msg.id!=='string') continue;
    const blocks=Array.isArray(msg.content)?msg.content:[];
    const text=blocks.map(record).map(b=>{
      if(b.type==='text' && typeof b.text==='string') return b.text;
      if(b.type==='image') return english?'[Image]':'[图片]';
      if(tools && b.type==='tool-call') return english?'[Tool: '+b.name+']':'[工具调用：'+b.name+']';
      return '';
    }).filter(Boolean).join('\n\n').replace(/\r\n/g,'\n').replace(/\n{3,}/g,'\n\n') || (english?'(No text content)':'(此消息没有文本内容)');
    const truncated=text.length>limit;
    items.push({seq:event.seq,time:event.time,messageId:msg.id,role,text:truncated?text.slice(0,limit)+(english?'…[truncated]':'…[已截断]'):text,truncated,
      ...(typeof data.turn==='number'?{turn:data.turn}:{}),...(typeof data.step==='number'?{step:data.step}:{})});
  }
  return items;
}
