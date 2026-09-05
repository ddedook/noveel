'use client'

import { createContext, useContext, type ReactNode } from 'react'

type DshChatContextValue = {
  dshSessionId: string
  busyEnter: 'queue' | 'steer'
  welcomeHint: string
}

const DshChatContext = createContext<DshChatContextValue | null>(null)

type DshChatProviderProps = {
  dshSessionId: string
  busyEnter: 'queue' | 'steer'
  welcomeHint: string
  children: ReactNode
}

export function DshChatProvider({
  dshSessionId,
  busyEnter,
  welcomeHint,
  children,
}: DshChatProviderProps) {
  return (
    <DshChatContext.Provider value={{ dshSessionId, busyEnter, welcomeHint }}>
      {children}
    </DshChatContext.Provider>
  )
}

export function useDshChatContext(): DshChatContextValue {
  const ctx = useContext(DshChatContext)
  if (!ctx) {
    throw new Error('useDshChatContext must be used within DshChatProvider')
  }
  return ctx
}

export function useDshChatContextOptional(): DshChatContextValue | null {
  return useContext(DshChatContext)
}
