import {test,expect} from 'vitest';
import {readItems} from '../src/timeline';
import {seedText} from '../src/export-text';
const event={seq:3,type:'user/message',surfaceOp:'append',time:0,data:{id:'1',role:'user',content:[{type:'text',text:'A\r\n\n\nB'},{type:'image'}]}};
test('normalizes paragraphs, annotates images and ignores replacement and checkpoint events',()=>{
  const items=readItems([event,{...event,surfaceOp:{op:'replace'}},{...event,data:{...event.data,source:{kind:'compact-checkpoint'}}}],100,false);
  expect(items.map(i=>i.text)).toEqual(['A\n\nB\n\n[图片]']);
  expect(readItems([event],1,false)[0]).toMatchObject({truncated:true,text:'A…[已截断]'});
});
test('reasoning is omitted and tool names are opt-in',()=>{
  const a={...event,type:'assistant/message',data:{message:{id:'a',content:[{type:'reasoning',text:'private'},{type:'tool-call',name:'read'}]}}};
  expect(readItems([a],100,false,true)[0].text).toBe('(No text content)');
  expect(readItems([a],100,true,true)[0].text).toBe('[Tool: read]');
});
test('seed includes the exact fixed source, time and ordered rows',()=>{
  const items=readItems([event],100,false);
  const source={sessionId:'s',title:'T',cwd:'C:/test',items,totalMessages:1,latestSeq:3,inherited:false};
  expect(seedText(source,items,0)).toBe([
    '我导出了一段历史对话，请把它作为后续讨论的上下文。下面是片段内容（来自另一个会话，不是我们当前对话）：','',
    '【对话片段导出】','来源会话：T（s）','来源工作区：C:/test','导出时间：1970-01-01 00:00:00 (UTC)','消息条数：1',
    '说明：以下是用户从既有会话中截取的上下文片段，供后续对话参考；"用户/助手"均指原会话参与者。','','═'.repeat(40),
    '[1] seq=3 · 用户 · 1970-01-01 00:00:00','A','','B','','[图片]','═'.repeat(40)].join('\n'));
});
