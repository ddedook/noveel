import assert from 'node:assert/strict'
import test from 'node:test'
import { ChatProjection } from './chat-projection.ts'

function ev(type: string, seq: number, data: Record<string, unknown> = {}) {
  return { type, seq, data }
}

test('text-delta accumulates in stable message id', () => {
  const p = new ChatProjection()
  p.applyEvent(ev('user/message', 1, { id: 'u1', content: [{ type: 'text', text: 'Hi' }], turn: 1 }))
  p.applyEvent(
    ev('assistant/chunk', 2, {
      turn: 1,
      step: 1,
      chunk: { type: 'text-delta', index: 0, text: 'Hello' },
    }),
  )
  p.applyEvent(
    ev('assistant/chunk', 3, {
      turn: 1,
      step: 1,
      chunk: { type: 'text-delta', index: 0, text: ' world' },
    }),
  )

  let snap = p.getSnapshot()
  assert.equal(snap.messages.length, 2)
  assert.equal(snap.messages[1]?.id, 'assistant-1-1')
  assert.equal(snap.messages[1]?.content[0]?.type, 'text')
  if (snap.messages[1]?.content[0]?.type === 'text') {
    assert.equal(snap.messages[1].content[0].text, 'Hello world')
  }
  assert.equal(snap.isRunning, true)

  p.applyEvent(ev('turn/end', 4, {}))
  snap = p.getSnapshot()
  assert.equal(snap.isRunning, false)
})

test('reasoning and text parts in same assistant step', () => {
  const p = new ChatProjection()
  p.applyEvent(ev('user/message', 1, { id: 'u1', content: [{ type: 'text', text: 'Q' }], turn: 1 }))
  p.applyEvent(
    ev('assistant/chunk', 2, {
      turn: 1,
      step: 1,
      chunk: { type: 'reasoning-delta', index: 0, text: 'think' },
    }),
  )
  p.applyEvent(
    ev('assistant/chunk', 3, {
      turn: 1,
      step: 1,
      chunk: { type: 'text-delta', index: 1, text: 'answer' },
    }),
  )

  const snap = p.getSnapshot()
  const assistant = snap.messages.find((m) => m.role === 'assistant')
  assert.ok(assistant)
  assert.equal(assistant.content.length, 2)
  assert.equal(assistant.content[0]?.type, 'reasoning')
  assert.equal(assistant.content[1]?.type, 'text')
})

test('tool-call-delta grows argsText and tool/result fills result', () => {
  const p = new ChatProjection()
  p.applyEvent(ev('user/message', 1, { id: 'u1', content: [{ type: 'text', text: 'Q' }], turn: 1 }))
  p.applyEvent(
    ev('assistant/chunk', 2, {
      turn: 1,
      step: 1,
      chunk: { type: 'tool-call-delta', index: 0, id: 'tc1', name: 'query_entities', argumentsDelta: '{"domain":' },
    }),
  )
  p.applyEvent(
    ev('assistant/chunk', 3, {
      turn: 1,
      step: 1,
      chunk: { type: 'tool-call-delta', index: 0, id: 'tc1', argumentsDelta: '"role"}' },
    }),
  )
  p.applyEvent(
    ev('tool/result', 4, {
      message: { toolCallId: 'tc1', content: [{ type: 'text', text: '{"rows":[]}' }] },
    }),
  )

  const snap = p.getSnapshot()
  const assistant = snap.messages.find((m) => m.role === 'assistant')
  assert.ok(assistant)
  const toolPart = assistant.content.find((c) => c.type === 'tool-call')
  assert.ok(toolPart && toolPart.type === 'tool-call')
  assert.equal(toolPart.argsText, '{"domain":"role"}')
  assert.equal(toolPart.result, '{"rows":[]}')
})

test('two turns produce two stable assistant ids', () => {
  const p = new ChatProjection()
  p.applyEvent(ev('user/message', 1, { id: 'u1', content: [{ type: 'text', text: 'Q1' }], turn: 1 }))
  p.applyEvent(
    ev('assistant/message', 2, {
      turn: 1,
      step: 1,
      message: { id: 'a1', content: [{ type: 'text', text: 'A1' }] },
    }),
  )
  p.applyEvent(ev('turn/end', 3, {}))
  p.applyEvent(ev('user/message', 4, { id: 'u2', content: [{ type: 'text', text: 'Q2' }], turn: 2 }))
  p.applyEvent(
    ev('assistant/message', 5, {
      turn: 2,
      step: 1,
      message: { id: 'a2', content: [{ type: 'text', text: 'A2' }] },
    }),
  )
  p.applyEvent(ev('turn/end', 6, {}))

  const snap = p.getSnapshot()
  const assistants = snap.messages.filter((m) => m.role === 'assistant')
  assert.equal(assistants.length, 2)
  assert.equal(assistants[0]?.id, 'a1')
  assert.equal(assistants[1]?.id, 'a2')
})

test('plugin user/message becomes context-injection on assistant step', () => {
  const p = new ChatProjection()
  p.applyEvent(
    ev('user/message', 1, {
      id: 'u1',
      content: [{ type: 'text', text: 'test' }],
      source: { kind: 'user' },
      turn: 1,
    }),
  )
  p.applyEvent(
    ev('user/message', 2, {
      id: 'ctx1',
      content: [{ type: 'text', text: 'catalog body' }],
      source: { kind: 'plugin', plugin: 'skill-catalog' },
      turn: 1,
      step: 1,
    }),
  )

  const snap = p.getSnapshot()
  assert.equal(snap.messages.length, 2)
  const assistant = snap.messages[1]
  assert.equal(assistant?.role, 'assistant')
  assert.equal(assistant?.content[0]?.type, 'context-injection')
  if (assistant?.content[0]?.type === 'context-injection') {
    assert.equal(assistant.content[0].label, 'skill-catalog')
    assert.equal(assistant.content[0].role, 'inject')
  }
})

test('assistant/message after streaming does not duplicate content', () => {
  const p = new ChatProjection()
  p.applyEvent(
    ev('user/message', 1, {
      id: 'u1',
      content: [{ type: 'text', text: 'test' }],
      source: { kind: 'user' },
      turn: 1,
    }),
  )
  p.applyEvent(
    ev('request/header', 2, {
      turn: 1,
      step: 1,
      header: { system: 'You are helpful.', config: { provider: 'deepseek', model: 'v4' } },
      reason: 'initial',
    }),
  )
  p.applyEvent(
    ev('assistant/chunk', 3, {
      turn: 1,
      step: 1,
      chunk: { type: 'reasoning-delta', index: 0, text: 'thinking' },
    }),
  )
  p.applyEvent(
    ev('assistant/chunk', 4, {
      turn: 1,
      step: 1,
      chunk: { type: 'text-delta', index: 1, text: 'Hello!' },
    }),
  )
  p.applyEvent(
    ev('assistant/message', 5, {
      turn: 1,
      step: 1,
      message: {
        id: 'a1',
        content: [
          { type: 'reasoning', text: 'thinking' },
          { type: 'text', text: 'Hello!' },
        ],
      },
    }),
  )
  p.applyEvent(ev('turn/end', 6, {}))

  const snap = p.getSnapshot()
  const assistants = snap.messages.filter((m) => m.role === 'assistant')
  assert.equal(assistants.length, 1)
  assert.equal(assistants[0]?.id, 'a1')
  assert.equal(assistants[0]?.content.length, 3)
  assert.equal(assistants[0]?.content[0]?.type, 'context-injection')
  assert.equal(assistants[0]?.content[1]?.type, 'reasoning')
  assert.equal(assistants[0]?.content[2]?.type, 'text')
})

test('duplicate system-prompt context injection is collapsed', () => {
  const p = new ChatProjection()
  p.applyEvent(
    ev('user/message', 1, {
      id: 'u1',
      content: [{ type: 'text', text: 'test' }],
      source: { kind: 'user' },
      turn: 1,
    }),
  )
  p.applyEvent(
    ev('request/header', 2, {
      turn: 1,
      step: 1,
      header: { system: 'You are helpful.' },
      reason: 'initial',
    }),
  )
  p.applyEvent(
    ev('user/message', 3, {
      id: 'ctx-system',
      content: [{ type: 'text', text: 'system body' }],
      source: { kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt' },
      turn: 1,
      step: 1,
    }),
  )

  const snap = p.getSnapshot()
  const assistant = snap.messages.find((m) => m.role === 'assistant')
  assert.ok(assistant)
  const injections = assistant.content.filter((c) => c.type === 'context-injection')
  assert.equal(injections.length, 1)
  if (injections[0]?.type === 'context-injection') {
    assert.equal(injections[0].role, 'system-prompt')
    assert.equal(injections[0].label, '@deepseek-ai/dsh-system-prompt')
  }
})

test('request/header context precedes reasoning chunks', () => {
  const p = new ChatProjection()
  p.applyEvent(
    ev('user/message', 1, {
      id: 'u1',
      content: [{ type: 'text', text: 'test' }],
      source: { kind: 'user' },
      turn: 1,
    }),
  )
  p.applyEvent(
    ev('request/header', 2, {
      turn: 1,
      step: 1,
      header: { system: 'You are helpful.', config: { provider: 'deepseek', model: 'v4' } },
      reason: 'initial',
    }),
  )
  p.applyEvent(
    ev('assistant/chunk', 3, {
      turn: 1,
      step: 1,
      chunk: { type: 'reasoning-delta', index: 0, text: 'thinking' },
    }),
  )

  const snap = p.getSnapshot()
  const assistant = snap.messages.find((m) => m.role === 'assistant')
  assert.ok(assistant)
  assert.equal(assistant.content.length, 2)
  assert.equal(assistant.content[0]?.type, 'context-injection')
  assert.equal(assistant.content[1]?.type, 'reasoning')
  if (assistant.content[0]?.type === 'context-injection') {
    assert.equal(assistant.content[0].role, 'system-prompt')
    assert.equal(assistant.content[0].label, '@deepseek-ai/dsh-system-prompt')
  }
})
