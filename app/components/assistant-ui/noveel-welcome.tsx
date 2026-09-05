'use client'

import { useDshChatContext } from '@/app/components/assistant-ui/dsh-chat-context'

export function NoveelWelcome() {
  const { welcomeHint } = useDshChatContext()

  return (
    <div className="aui-thread-welcome-root mb-6 flex flex-col items-center px-4 text-center">
      <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-medium tracking-tight duration-200">
        {welcomeHint}
      </h1>
      <p className="mt-2 text-sm text-muted">向 AI 助手提问，开始对话。</p>
    </div>
  )
}
