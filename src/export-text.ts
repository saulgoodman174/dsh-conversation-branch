import type {Item,Timeline} from './types';
const utc=(ms:number)=>new Date(ms).toISOString().slice(0,19).replace('T',' ');
export function seedText(source:Timeline,items:Item[],now=Date.now(),en=false) {
  const rule='═'.repeat(40);
  const header=en?['I exported a conversation excerpt to use as context for our discussion.','',
    '[Conversation excerpt]','Source: '+source.title+' ('+source.sessionId+')','Workspace: '+source.cwd,
    'Exported: '+utc(now)+' (UTC)','Messages: '+items.length,'User and assistant refer to the original participants.']:
    ['我导出了一段历史对话，请把它作为后续讨论的上下文。下面是片段内容（来自另一个会话，不是我们当前对话）：','',
    '【对话片段导出】','来源会话：'+source.title+'（'+source.sessionId+'）','来源工作区：'+source.cwd,'导出时间：'+utc(now)+' (UTC)',
    '消息条数：'+items.length,'说明：以下是用户从既有会话中截取的上下文片段，供后续对话参考；"用户/助手"均指原会话参与者。'];
  const rows=items.map((i,n)=>'['+(n+1)+'] seq='+i.seq+' · '+(en?i.role:i.role==='user'?'用户':'助手')+' · '+utc(i.time)+'\n'+i.text);
  return [...header,'',rule,rows.join('\n'+rule+'\n'),rule].join('\n');
}
