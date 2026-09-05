import { MessageSquare } from 'lucide-react'
import { Button } from '@heroui/react'
import { useLayoutStore } from '@/app/lib/layout-store'
import { cn } from '@/app/lib/utils'

export function ChatPanelTrigger({ className }: { className?: string }) {
  const chat = useLayoutStore((s) => s.chat)
  const openChat = useLayoutStore((s) => s.openChat)

  if (chat > 0) return null

  return (
    <Button
      type="button"
      isIconOnly
      aria-label="打开 AI 对话"
      onPress={openChat}
      className={cn(
        'fixed bottom-6 right-6 z-40 size-11 rounded-full shadow-[var(--noveel-elevation-1)] active:scale-[0.96] transition-transform',
        className,
      )}
    >
      <MessageSquare className="size-5" strokeWidth={1.5} />
    </Button>
  )
}
