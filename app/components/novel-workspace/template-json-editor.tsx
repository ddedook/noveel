'use client'

import { useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'
import { cn } from '@/app/lib/utils'

type TemplateJsonEditorProps = {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  className?: string
}

export function TemplateJsonEditor({ value, onChange, readOnly, className }: TemplateJsonEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [editorHeight, setEditorHeight] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateHeight = () => {
      setEditorHeight(el.clientHeight)
    }

    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className={cn('h-full min-h-0', className)}>
      {editorHeight > 0 ? (
        <CodeMirror
          value={value}
          height={`${String(editorHeight)}px`}
          extensions={[json(), EditorView.lineWrapping]}
          readOnly={readOnly}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
          }}
          onChange={onChange}
          className="h-full overflow-hidden rounded-md border border-border text-sm [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-scroller]:font-mono"
        />
      ) : null}
    </div>
  )
}
