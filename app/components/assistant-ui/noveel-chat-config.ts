'use client'

import { AuiConfig, Tools, makeAssistantDataUI } from '@assistant-ui/react'
import noveelToolkit from '@/app/components/assistant-ui/noveel-toolkit'
import { ContextInjectionRow } from '@/app/components/assistant-ui/elements/context-injection-row.aui'
import { NoveelWelcome } from '@/app/components/assistant-ui/noveel-welcome'
import type { ThreadComponents } from '@/app/components/assistant-ui/elements/thread.aui'

export const ContextInjectionDataUI = makeAssistantDataUI({
  name: 'context-injection',
  render: ContextInjectionRow,
})

export const NOVEEL_CHAT_AUI_CONFIG = AuiConfig({
  tools: Tools({ toolkit: noveelToolkit }),
})

export const NOVEEL_THREAD_COMPONENTS: ThreadComponents = {
  Welcome: NoveelWelcome,
}
