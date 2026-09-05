'use client'

import { defineToolkit, type ToolCallMessagePartProps } from '@assistant-ui/react'
import { DshToolRow } from '@/app/components/assistant-ui/elements/dsh-tool-row.aui'

const NOVEEL_TOOL_LABELS: Record<string, string> = {
  describe_schema: 'describe_schema',
  query_entities: 'query_entities',
  get_entities: 'get_entities',
  mutate_entities: 'mutate_entities',
  novel_status: 'novel_status',
}

function NoveelToolRender(props: ToolCallMessagePartProps) {
  const label = NOVEEL_TOOL_LABELS[props.toolName] ?? props.toolName
  return <DshToolRow {...props} toolName={label} />
}

const noveelToolkit = defineToolkit({
  describe_schema: {
    type: 'backend',
    render: NoveelToolRender,
  },
  query_entities: {
    type: 'backend',
    render: NoveelToolRender,
  },
  get_entities: {
    type: 'backend',
    render: NoveelToolRender,
  },
  mutate_entities: {
    type: 'backend',
    render: NoveelToolRender,
  },
  novel_status: {
    type: 'backend',
    render: NoveelToolRender,
  },
})

export default noveelToolkit
