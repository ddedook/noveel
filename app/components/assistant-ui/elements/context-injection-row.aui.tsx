'use client'

import { useState } from 'react'
import { ChevronDownIcon, FileInputIcon } from 'lucide-react'
import type { DataMessagePartComponent } from '@assistant-ui/react'
import { Disclosure } from '@heroui/react'
import { cn } from '@/app/lib/utils'

type ContextInjectionData = {
  role: 'inject' | 'recall' | 'system-prompt'
  label: string
  summary?: string
}

const ContextInjectionRowImpl: DataMessagePartComponent<ContextInjectionData> = ({
  data,
}) => {
  const [expanded, setExpanded] = useState(false)
  const title =
    data.role === 'recall'
      ? '跨会话召回'
      : data.role === 'system-prompt'
        ? '系统提示'
        : '上下文注入'

  return (
    <Disclosure
      isExpanded={expanded}
      onExpandedChange={setExpanded}
      className="aui-context-injection-root mb-0.5 w-full"
    >
      <Disclosure.Heading>
        <Disclosure.Trigger
          className={cn(
            'text-muted hover:text-foreground flex max-w-full origin-left items-center gap-1.5 py-0.5 text-xs transition-[color,transform] active:scale-[0.96]',
          )}
        >
          <FileInputIcon className="size-3.5 shrink-0 stroke-[1.5] opacity-70" />
          <span className="shrink-0">{title}</span>
          <span className="bg-default/40 size-0.5 shrink-0 rounded-full" aria-hidden />
          <span className="text-muted/80 min-w-0 truncate">{data.label}</span>
          {data.summary ? (
            <>
              <span className="bg-default/40 size-0.5 shrink-0 rounded-full" aria-hidden />
              <span className="text-muted/70 min-w-0 truncate">{data.summary}</span>
            </>
          ) : null}
          <ChevronDownIcon
            className={cn(
              'size-3.5 shrink-0 stroke-[1.5] opacity-60 transition-transform',
              expanded && 'rotate-180',
            )}
          />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      {data.summary ? (
        <Disclosure.Content className="text-muted bg-default/40 mt-0.5 ml-4 max-h-36 overflow-y-auto rounded-md px-2 py-1.5 text-xs whitespace-pre-wrap">
          {data.summary}
        </Disclosure.Content>
      ) : null}
    </Disclosure>
  )
}

export { ContextInjectionRowImpl as ContextInjectionRow }
