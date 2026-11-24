import {useState,useSyncExternalStore,useEffect,useRef} from 'react';
import type {Translate} from './locales';
import type {Store} from './store';
export interface Props {sessionId:string;t:Translate;messageId?:string;inputActions?:{setDraft(s:string):void}}
export function Panel({store,sessionId,t}:{store:Store}&Props){
  const state=useSyncExternalStore(store.subscribe,store.snapshot);
  if(state.sessionId!==sessionId) return null;
  return <Dialog key={sessionId} store={store} t={t} sessionId={sessionId}/>;
}
function Dialog({store,t,sessionId}:{store:Store}&Props){
  const state=useSyncExternalStore(store.subscribe,store.snapshot);
  const [query,search]=useState(''),[role,filter]=useState('all'),[selected,select]=useState(new Set<number>()),[expanded,expand]=useState(new Set<number>());
  const dialog=useRef<HTMLDivElement>(null),searchbox=useRef<HTMLInputElement>(null);
  const retry=useRef<()=>void>(()=>{void store.open(sessionId,t('language'),state.focus)});
  useEffect(()=>{const previous=document.activeElement;searchbox.current?.focus();return ()=>{if(previous instanceof HTMLElement && previous.isConnected)previous.focus()}},[]);
  useEffect(()=>{if(state.focus && state.data) dialog.current?.querySelector('[data-focused="true"]')?.scrollIntoView({block:'center'})},[state.focus,state.data]);
  const items=(state.data?.items||[]).filter(i=>(role==='all'||role===i.role)&&i.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  function toggle(set:Set<number>,seq:number){const next=new Set(set);if(next.has(seq))next.delete(seq);else next.add(seq);return next}
  function run(method:'exportSegment'|'branch',args:object){retry.current=()=>{void store.act(method,args,t('language'))};retry.current()}
  return <div className="dsb-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!state.busy)store.close()}}>
    <div className="dsb-dialog" ref={dialog} role="dialog" aria-modal="true" aria-label={t('title')} onKeyDown={e=>{
      if(e.key==='Escape'&&!state.busy){e.stopPropagation();store.close()}
      if(e.key==='Tab'){const nodes=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select');if(!nodes?.length)return;
        const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
    }}>
    <header><div><h2>{t('title')}</h2><small>{state.data?.title} {state.data && ' · '+state.data.totalMessages}</small></div><button disabled={state.busy} onClick={()=>store.close()}>{t('close')}</button></header>
    <div className="dsb-tools"><input ref={searchbox} aria-label={t('search')} placeholder={t('search')} value={query} onChange={e=>search(e.target.value)}/>
    <select aria-label={t('all')} value={role} onChange={e=>filter(e.target.value)}>{(['all','user','assistant'] as const).map(r=><option key={r} value={r}>{t(r)}</option>)}</select>
    <button onClick={()=>select(new Set([...selected,...items.map(i=>i.seq)]))}>{t('allShown')}</button><button onClick={()=>select(new Set())}>{t('clear')}</button></div>
    {state.error && <p role="alert">{state.error.code} · {state.error.message} <button onClick={()=>retry.current()}>{t('retry')}</button></p>}
    {state.created && <p role="status">{t('nav')} <code>{state.created}</code></p>}
    <div className="dsb-list">{!state.data&&!state.error?t('loading'):null}{state.data&&items.length===0?t('empty'):null}
    {items.map(i=><article key={i.seq} data-seq={i.seq} data-focused={state.focus===i.messageId}><input type="checkbox" aria-label={'#'+i.seq} checked={selected.has(i.seq)} onChange={()=>select(toggle(selected,i.seq))}/>
    <div><small>#{i.seq} · {t(i.role)} · {new Date(i.time).toLocaleString()}</small>
    <button className="dsb-text" aria-expanded={expanded.has(i.seq)} onClick={()=>expand(toggle(expanded,i.seq))}>{expanded.has(i.seq)||i.text.length<=160?i.text:i.text.slice(0,160)+'…'}</button></div>
    <button disabled={state.busy} onClick={()=>run('branch',{atSeq:i.seq})}>{t(i.role==='user'?'edit':'restart')}</button></article>)}</div>
    <footer><small>{t('hint')}</small><span>{t('selected')} {selected.size}</span><button disabled={!selected.size||state.busy} onClick={()=>run('exportSegment',{seqs:[...selected]})}>{t(state.busy?'busy':'export')}</button></footer>
    </div></div>
}
export function Prefill({store,sessionId,inputActions,t}:{store:Store}&Props){
  const [fallback,setFallback]=useState('');
  useEffect(()=>{
    setFallback('');
    const text=store.drafts.get(sessionId);if(!text)return;
    let timer:ReturnType<typeof setTimeout>;
    function attempt(n:number){if(!store.drafts.has(sessionId))return;try{if(inputActions && text){inputActions.setDraft(text);store.drafts.delete(sessionId);return}}catch{}
      if(n<3)timer=setTimeout(()=>attempt(n+1),150+n*250);else setFallback(text||'')}
    attempt(0);return ()=>clearTimeout(timer);
  },[store,sessionId,inputActions]);
  return fallback?<div>{t('manual')} <button onClick={()=>navigator.clipboard.writeText(fallback)}>{t('copy')}</button><textarea readOnly value={fallback}/></div>:null;
}

