import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {seedText} from '../../src/export-text.ts';
export async function scenario(page,url,record){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.openPkgtestSession==='function',null,{timeout:18000});
  const post=(route,body)=>page.evaluate(async ({route,body})=>{
    const r=await fetch(new URL('api/'+route,document.baseURI),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {status:r.status,contentType:r.headers.get('content-type'),text:await r.text()};
  },{route,body});
  async function json(route,body){
    const raw=await post(route,body);
    try {
      assert.ok(raw.status>=200&&raw.status<300);
      assert.match(raw.contentType||'',/application\/json/i);
      return JSON.parse(raw.text);
    } catch(error){record(JSON.stringify({route,action:body.action,...raw}));throw error}
  }
  const fixture=body=>json('rewind-fixture',body);
  const call=(method,body)=>json('dsh-conversation-branch/'+method,body);
  const {sessionId}=await fixture({action:'seed'}),args={sessionId};
  const original=(await call('timeline',args)).value;
  assert.equal(original.items.length,6);
  const sourceLog=(await fixture({action:'inspect',id:sessionId})).log;
  assert.equal(original.items[0].seq,3);
  const open=async id=>{await page.waitForFunction(id=>window.pkgtestSessionListed?.(id),id);await page.evaluate(id=>window.openPkgtestSession(id),id);await page.locator('.dsb-trigger').first().waitFor({timeout:15000})};
  const panel=async()=>{await page.locator('.dsb-trigger').filter({hasText:/Time Machine|时光机/}).first().click();await page.locator('.dsb-list article').first().waitFor()};
  const art=new URL('../../docs/',import.meta.url);await mkdir(art,{recursive:true});
  const {fileURLToPath}=await import('node:url');
  const snap=name=>page.screenshot({path:fileURLToPath(new URL(name,art))});
  async function watch(method,click){
    const res=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/dsh-conversation-branch/'+method)&&r.request().method()==='POST');
    const [response]=await Promise.all([res,click()]);const data=await response.json();assert.equal(data.ok,true,JSON.stringify(data));return data.value;
  }
  await open(sessionId);const notice=page.getByRole('dialog').filter({hasText:/预览版说明|Preview Notice/i});if(await notice.isVisible())await notice.getByRole('button',{name:/继续|Continue/i}).click();const welcome=page.getByRole('dialog').filter({hasText:/添加 API Key|Add API Key/i});await welcome.waitFor({timeout:4000}).catch(()=>{});if(await welcome.isVisible()){record('Welcome controls: '+JSON.stringify(await welcome.getByRole('button').evaluateAll(bs=>bs.map(b=>[b.innerText,b.getAttribute('aria-label'),b.title]))));await welcome.getByRole('button',{name:/关闭|Close/i}).click()}await panel();await snap('timeline.png');
  await page.keyboard.press('Escape');
  await page.locator('button.dsb-trigger[title]').last().click();
  await page.locator('.dsb-list article[data-focused=true]').waitFor();
  for(const index of [0,3]){
    const item=original.items[index],anchor=original.items[index===0?0:2];
    const branch=await watch('branch',()=>page.locator('article[data-seq="'+item.seq+'"] button').last().click());
    assert.equal(branch.boundarySeq,anchor.seq-1);assert.equal(branch.prefill,anchor.text);
    await page.waitForFunction(text=>[...document.querySelectorAll('textarea:not([readonly]),[contenteditable=true]')].some(e=>(e.value??e.textContent)===text),anchor.text,{timeout:12000});
    const stored=await fixture({action:'inspect',id:branch.sessionId});
    assert.equal(stored.parent,sessionId);assert.equal(stored.inherited,anchor.seq);
    assert.deepEqual(stored.log.slice(0,stored.inherited),sourceLog.slice(0,anchor.seq));
    assert.deepEqual(stored.events.map(e=>e.seq),original.items.slice(0,index===0?0:2).map(i=>i.seq));
    await snap('branch.png');await open(sessionId);await panel();
  }
  assert.deepEqual((await call('timeline',args)).value.items,original.items);
  record('PASS A1-A3: six messages; user and assistant branches; inclusive prefix, source and both drafts verified');
  const selected=original.items.slice(0,2);
  for(const i of selected)await page.locator('article[data-seq="'+i.seq+'"] input').check();
  const child=await watch('exportSegment',()=>page.locator('.dsb-dialog footer button').click());
  await page.locator('.dsb-dialog').waitFor({state:'hidden'});
  await page.reload();await page.waitForFunction(()=>typeof window.openPkgtestSession==='function');await open(child.sessionId);await welcome.waitFor({timeout:4000}).catch(()=>{});if(await welcome.isVisible())await welcome.getByRole('button',{name:/关闭|Close/i}).click();await panel();
  assert.equal(await page.locator('.dsb-list article').count(),1);
  const stored=await fixture({action:'inspect',id:child.sessionId});
  assert.equal(stored.events.length,1);assert.equal(stored.events[0].type,'user/message');assert.equal(stored.events[0].seq,child.seedSeq);
  const text=stored.events[0].data.content[0].text;
  const timestamp=text.match(/(?:导出时间：|Exported: )(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) \(UTC\)/);
  assert.ok(timestamp);const expected=seedText(original,selected,Date.parse(timestamp[1].replace(' ','T')+'Z'),text.startsWith('I exported'));
  assert.equal(text,expected);assert.equal(stored.history[0].content[0].text,expected);
  assert.equal(stored.history[0].role,'user');assert.equal(stored.history[0].content[0].text,text);
  assert.equal(text.length,child.chars);assert.ok(text.includes('Question 0')&&text.includes('Answer 0')&&!text.includes('Question 1'));
  assert.equal((await call('timeline',{sessionId:child.sessionId})).value.items[0].text,text);
  await snap('export.png');
  for(const [method,body,code] of [['timeline',{sessionId:'missing-test'},'not-found'],['branch',{...args,atSeq:-1},'bad-request'],['exportSegment',{...args,seqs:[]},'export-empty']]){
    const r=await call(method,body);assert.equal(r.error.code,'rewind/'+code);
  }
  const big=await fixture({action:'seed',large:true});
  const bigItems=(await call('timeline',big)).value.items;
  const over=await call('exportSegment',{...big,seqs:bigItems.map(i=>i.seq)});
  assert.equal(over.error.code,'rewind/export-too-large');
  assert.deepEqual(errors,[]);
  record('PASS A4-A5: refreshed child, observed seed seq '+child.seedSeq+', one user message and identical deriveMessages()[0] text; errors and page exceptions checked');
}


