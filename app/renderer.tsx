import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Toast } from '@heroui/react'
import { ThemeBootstrap } from '@/app/components/layout/theme-bootstrap'
import { router } from '@/app/router'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@/app/styles/globals.css'
import '@/app/styles/theme-colors.css'
import '@/app/styles/shell-tokens.css'
import '@/app/styles/desktop-shell.css'
import '@/app/styles/window-chrome.css'
import '@/app/styles/novel-workspace.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
})

export default function App() {
  return (
    <ThemeProvider
      attribute={['class', 'data-theme']}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="noveel-color-mode"
    >
      <QueryClientProvider client={queryClient}>
        <ThemeBootstrap />
        <RouterProvider router={router} />
        <Toast.Provider placement="bottom end" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
