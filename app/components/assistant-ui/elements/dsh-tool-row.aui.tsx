'use client'

import { memo, useCallback, useRef, useState } from 'react'
import { ChevronDownIcon, LoaderIcon, SparklesIcon } from 'lucide-react'
import {
  useScrollLock,
  useToolCallElapsed,
  type ToolCallMessagePartComponent,
  type ToolCallMessagePartStatus,
} from '@assistant-ui/react'
import { Disclosure } from '@heroui/react'
import { cn } from '@/app/lib/utils'

const ANIMATION_DURATION = 200

function truncateArgs(argsText: string, max = 48): string {
  const trimmed = argsText.trim()
  if (trimmed.length <= max) return trimmed || '{}'
  return `${trimmed.slice(0, max)}…`
}

function DshToolRowTrigger({
  toolName,
  argsText,
  status,
}: {
  toolName: string
  argsText: string
  status?: ToolCallMessagePartStatus
}) {
  const isRunning = status?.type === 'running'
  const elapsedMs = useToolCallElapsed()

  return (
    <Disclosure.Heading>
      <Disclosure.Trigger
        className={cn(
          'aui-dsh-tool-row-trigger group/trigger text-muted hover:text-foreground flex max-w-full origin-left items-center gap-2 py-0.5 text-xs transition-[color,transform] active:scale-[0.96]',
        )}
      >
        {isRunning ? (
          <LoaderIcon className="size-4 shrink-0 animate-spin stroke-[1.5]" />
        ) : (
          <SparklesIcon className="size-4 shrink-0 stroke-[1.5] opacity-70" />
        )}
        <span className="min-w-0 truncate">
          Tool call · <span className="text-foreground/90">{toolName}</span> ·{' '}
          <span className="text-muted/80 font-mono text-xs">
            {truncateArgs(argsText)}
          </span>
        </span>
        {elapsedMs != null ? (
          <span className="text-muted/60 shrink-0 text-xs tabular-nums">
            {Math.round(elapsedMs / 1000)}s
          </span>
        ) : null}
        <ChevronDownIcon
          className={cn(
            'size-4 shrink-0 stroke-[1.5] opacity-60 transition-transform',
            'group-data-[expanded=true]/trigger:rotate-180',
          )}
        />
      </Disclosure.Trigger>
    </Disclosure.Heading>
  )
}

const DshToolRowImpl: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
  isError,
}) => {
  const collapsibleRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION)

  const handleExpandedChange = useCallback(
    (next: boolean) => {
      lockScroll()
      setExpanded(next)
    },
    [lockScroll],
  )

  return (
    <Disclosure
      ref={collapsibleRef}
      isExpanded={expanded}
      onExpandedChange={handleExpandedChange}
      className="aui-dsh-tool-row-root group/trigger mb-1 w-full"
    >
      <DshToolRowTrigger toolName={toolName} argsText={argsText} status={status} />
      <Disclosure.Content className="text-muted mt-1 ml-5 space-y-2 text-xs">
        <pre className="bg-default/40 overflow-x-auto rounded-md p-2 font-mono whitespace-pre-wrap">
          {argsText || '{}'}
        </pre>
        {result ? (
          <pre
            className={cn(
              'overflow-x-auto rounded-md p-2 font-mono whitespace-pre-wrap',
              isError ? 'bg-danger/10 text-danger' : 'bg-default/40',
            )}
          >
            {result}
          </pre>
        ) : null}
      </Disclosure.Content>
    </Disclosure>
  )
}

export const DshToolRow = memo(DshToolRowImpl)
