import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// DSH_PACKAGE_ROOT points to the extracted node_modules/@deepseek-ai directory.
const root = process.env.DSH_PACKAGE_ROOT ??
  'C:/Users/Deng/Desktop/ds/.research/dsh-src/dsh/node_modules/@deepseek-ai';
const manifest = JSON.parse(await readFile(path.join(root, 'dsh-web-app/package.json'), 'utf8'));
console.log('runtime:', process.version, manifest.name, manifest.version);
assert.equal(manifest.version, '0.2.1-rc.3');
const { Session } = await import(pathToFileURL(path.join(root, 'dsh-session/lib/index.js')));
const id = 'session-spike-' + randomUUID();
const header = {
  version: 4, id, createdAt: Date.now(), cwd: process.cwd(),
  isSeeded: false, delegationDepth: 0, agentPreset: 'standard',
};
const session = Session.create(id, [], header, 0, []);
const initialEvents = session.snapshotEvents();
console.log('seq after create:', session.seq);
console.log('initial events:', JSON.stringify(initialEvents));
assert.equal(session.seq, 1);
assert.deepEqual(session.deriveMessages(), []);

const user = {
  role: 'user', content: [{ type: 'text', text: '导出的上下文片段' }],
  source: { kind: 'user', rpcId: randomUUID(), clientTimeZone: 'UTC' }, id: randomUUID(),
};
const userEvent = session.append('user/message', user, { surfaceOp: 'append' });
assert.equal(userEvent.seq, 1);
assert.equal(userEvent.surfaceOp, 'append');
assert.deepEqual(session.deriveMessages(), [user]);
console.log('seq after user append:', session.seq, 'messages:', JSON.stringify(session.deriveMessages()));

const assistant = {
  role: 'assistant', content: [{ type: 'text', text: '助手回复' }],
  source: { kind: 'model', provider: 'fixture', model: 'fixture' }, id: randomUUID(),
};
const assistantEvent = session.append('assistant/message', {
  turn: 0, step: 0, message: assistant, stream: [],
}, { surfaceOp: 'append' });
assert.equal(assistantEvent.seq, 2);
assert.equal(assistantEvent.surfaceOp, 'append');
assert.deepEqual(session.deriveMessages(), [user, assistant]);
assert.deepEqual(session.surface.nodes, [1, 2]);
console.log('seq after assistant append:', session.seq, 'messages:', JSON.stringify(session.deriveMessages()));
console.log('surface nodes:', JSON.stringify(session.surface.nodes));

assert.equal(initialEvents.length, 1);
assert.equal(initialEvents[0].seq, 0);
assert.equal(initialEvents[0].type, 'session/end-seed');
assert.deepEqual(initialEvents[0].data, {});
console.log('PASS: seed marker, append positions, surface and derived messages');
