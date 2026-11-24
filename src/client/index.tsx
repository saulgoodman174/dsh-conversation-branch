import type {ComponentType} from 'react';
import {Panel,Prefill,type Props} from './panel';
import {panelStore} from './store';
import {zh,en} from './locales';
import {css} from './styles';
export const name='dsh-conversation-branch';
export const inject=['slots','locale','uiWorkspace'];
interface Client {
  effect(fn:()=>unknown,label:string):void;
  get(name:'uiWorkspace'):{openSession(id:string):void}|undefined;
  locale:{register(ns:string,dictionaries:object):unknown};
  slots:{inject(name:string,fn:()=>unknown):unknown;register(opts:object,component:ComponentType<Props>):unknown};
}
export function apply(ctx:Client){
  const store=panelStore(id=>{const ui=ctx.get('uiWorkspace');if(!ui)return false;ui.openSession(id);return true});
  ctx.effect(()=>ctx.locale.register(name,{en,zh}),name+' locale');
  ctx.effect(()=>{const style=document.createElement('style');style.textContent=css;document.head.append(style);return ()=>style.remove()},name+' style');
  function slot(key:string,id:string,order:number,component:ComponentType<Props>){
    ctx.slots.inject(key,()=>ctx.slots.register({name:key,id:name+'-'+id,order,locale:name,inject:(sessionId:string)=>({sessionId})},component));
  }
  slot('conversation.session.header.actions','header',60,({sessionId,t})=><button className="dsb-trigger" onClick={()=>store.open(sessionId,t('language'))}>⏪ {t('open')}</button>);
  slot('conversation.chat.assistant-actions','assistant',30,({sessionId,messageId,t})=><button className="dsb-trigger" title={t('restart')} aria-label={t('restart')} onClick={()=>store.open(sessionId,t('language'),messageId)}>⏪</button>);
  slot('conversation.input.overlay','panel',30,props=><><Panel {...props} store={store}/><Prefill {...props} store={store}/></>);
  slot('conversation.composer.dock','prefill',90,props=><Prefill {...props} store={store}/>);
}

