import {
  ChatProjection,
  projectionFromRecords,
  type ChatSnapshot,
  type HistoryRecord,
  type WireEvent,
} from '@/lib/main/dsh/chat-projection'

export type { HistoryRecord, WireEvent, ChatSnapshot }

export function snapshotFromRecords(records: HistoryRecord[]): ChatSnapshot {
  return projectionFromRecords(records)
}

export function serializeFollowFrame(
  frame: unknown,
  projection: ChatProjection,
): Record<string, unknown> {
  if (typeof frame !== 'object' || frame === null) return { kind: 'unknown' }

  const typed = frame as {
    type?: string
    records?: HistoryRecord[]
    event?: WireEvent
    cursor?: number
  }

  if (typed.type === 'snapshot') {
    projection.reset()
    projection.applyRecords(typed.records ?? [])
    const snap = projection.getSnapshot()
    return {
      kind: 'snapshot',
      cursor: typed.cursor,
      messages: snap.messages,
      isRunning: snap.isRunning,
      modelSelection: snap.modelSelection,
      ...(snap.turnError ? { turnError: snap.turnError } : {}),
    }
  }

  if (typed.type === 'event' && typed.event) {
    projection.applyEvent(typed.event)
    const snap = projection.getSnapshot()
    return {
      kind: 'snapshot',
      messages: snap.messages,
      isRunning: snap.isRunning,
      modelSelection: snap.modelSelection,
      ...(snap.turnError ? { turnError: snap.turnError } : {}),
    }
  }

  return { kind: 'unknown', frame }
}
