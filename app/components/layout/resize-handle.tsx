import { useCallback, useRef, useState } from 'react'
import { cn } from '@/app/lib/utils'

type ResizeHandleProps = {
  side: 'sidebar' | 'chat'
  left: number
  onStart: () => void
  onDrag: (dx: number) => void
  onEnd: () => void
}

export function ResizeHandle({ side, left, onStart, onDrag, onEnd }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false)
  const origin = useRef(0)
  const callbacks = useRef({ onStart, onDrag, onEnd })
  callbacks.current = { onStart, onDrag, onEnd }

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    origin.current = event.clientX
    callbacks.current.onStart()
    setDragging(true)
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    callbacks.current.onDrag(event.clientX - origin.current)
  }, [dragging])

  const finish = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    setDragging(false)
    callbacks.current.onEnd()
  }, [dragging])

  return (
    <div
      aria-hidden="true"
      className={cn(
        'noveel-resize-handle absolute top-0 bottom-0 z-50 -ml-1 w-2 cursor-col-resize touch-none',
        dragging && 'bg-border/60',
      )}
      data-active={dragging || undefined}
      data-resize-side={side}
      style={{ left }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    />
  )
}
