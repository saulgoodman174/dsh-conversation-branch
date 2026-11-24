import {expect,test,vi} from 'vitest';
import {RewindService,defaults} from '../src/service';
import {apply} from '../src';
import type {Host} from '../src/types';
const user={seq:3,type:'user/message',surfaceOp:'append',time:0,data:{id:'u',content:[{type:'text',text:'hello'}]}};
const assistant={seq:4,type:'assistant/message',surfaceOp:'append',time:1,data:{message:{id:'a',content:[{type:'text',text:'answer'}]}}};
function fixture(){
  const dispose=vi.fn(),append=vi.fn(()=>({seq:7})),flush=vi.fn(async()=>true),create=vi.fn(async()=>({sessionId:'child'})),fork=vi.fn(async()=>({sessionId:'fork'}));
  const host:Host={sessionQuery:{observeSession:async id=>{if(id!=='source')throw Error();return {header:{id,cwd:'cwd',isSeeded:false},events:[user,assistant,{...user,surfaceOp:'replace'}],[Symbol.dispose]:dispose}},readTitle:async()=>'Title'},
    workspaceRegistry:{list:()=>[{id:'w',sessionIds:['source']}]},sessionController:{create,fork,rename:vi.fn(async()=>({}))},sessions:{get:()=>({append}),flush},connection:{fetch:{register:vi.fn()}}};
  return {host,dispose,append,flush,create,fork,s:new RewindService(host)};
}
test('append-only timeline and inclusive fork',async()=>{
  const {s,dispose,fork}=fixture();expect((await s.timeline({sessionId:'source'})).items.map(i=>i.text)).toEqual(['hello','answer']);
  for(const atSeq of [3,4]) expect(await s.branch({sessionId:'source',atSeq})).toMatchObject({anchorSeq:3,boundarySeq:2,prefill:'hello'});
  expect(fork).toHaveBeenCalledWith({sessionId:'source',atSeq:2});expect(dispose).toHaveBeenCalledTimes(3);
});
test('export once in source order with observed seq',async()=>{
  const {s,create,append,flush}=fixture();
  expect(await s.exportSegment({sessionId:'source',seqs:[4,3,4]})).toMatchObject({messageCount:2,seedSeq:7});
  expect(create).toHaveBeenCalledWith({workspaceId:'w'});expect(append).toHaveBeenCalledTimes(1);expect(flush).toHaveBeenCalledOnce();
  expect(append).toHaveBeenCalledWith('user/message',expect.objectContaining({content:[{type:'text',text:expect.stringMatching(/hello[\s\S]*answer/)}]}),{surfaceOp:'append'});
});
test('invalid and oversized selections create nothing',async()=>{
  const {host,create}=fixture(), s=new RewindService(host,{...defaults,maxExportChars:1});
  for(const [args,code] of [[{sessionId:'source',seqs:[]},'export-empty'],[{sessionId:'x',seqs:[3]},'not-found'],[{sessionId:'source',seqs:[-1]},'bad-request'],[{sessionId:'source',seqs:[3]},'export-too-large']] as const)
    await expect(s.exportSegment(args)).rejects.toMatchObject({code:'rewind/'+code});
  expect(create).not.toHaveBeenCalled();
});
test.each(['false','throw'])('flush %s reports durability failure',async mode=>{
  const {s,flush}=fixture();if(mode==='false')flush.mockResolvedValue(false);else flush.mockRejectedValue(Error());
  await expect(s.exportSegment({sessionId:'source',seqs:[3]})).rejects.toMatchObject({code:'rewind/durability-failed'});
});
test('mounts four authenticated POST handlers',()=>{const {host}=fixture();apply(host);expect(host.connection.fetch.register).toHaveBeenCalledTimes(4)});


