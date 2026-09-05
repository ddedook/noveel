import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import type React from 'react'
import { AppShell } from '@/app/components/layout/app-shell'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  component: AppShell,
})

const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/',
  component: function IndexPage() {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <h1 className="mb-2 text-2xl font-semibold">欢迎使用 Noveel</h1>
        <p className="text-muted">从左侧创建或选择一本小说开始创作</p>
      </div>
    )
  },
})

function createNovelFeatureRoute(path: string, component: React.ComponentType) {
  const Wrapped = () => {
    const Page = component
    return <Page />
  }
  return createRoute({
    getParentRoute: () => layoutRoute,
    path: `/novel/$id/${path}`,
    component: Wrapped,
  })
}

import { NovelBasicPage } from '@/app/pages/novel/basic-page'
import { NovelOverviewPage } from '@/app/pages/novel/overview-page'
import { NovelWorldPage } from '@/app/pages/novel/world-page'
import { NovelRolePage } from '@/app/pages/novel/role-page'
import { NovelCreaturePage } from '@/app/pages/novel/creature-page'
import { NovelItemPage } from '@/app/pages/novel/item-page'
import { NovelLevelPage } from '@/app/pages/novel/level-page'
import { NovelTimelinePage } from '@/app/pages/novel/timeline-page'
import { NovelOutlinePage } from '@/app/pages/novel/outline-page'
import { NovelChaptersPage } from '@/app/pages/novel/chapters-page'
import { NovelTemplatePage } from '@/app/pages/novel/template-page'
import { NovelSkillsPage } from '@/app/pages/novel/skills-page'

const novelRedirectRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/novel/$id',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/novel/$id/overview', params: { id: params.id } })
  },
})

const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([
    indexRoute,
    novelRedirectRoute,
    createNovelFeatureRoute('basic', NovelBasicPage),
    createNovelFeatureRoute('overview', NovelOverviewPage),
    createNovelFeatureRoute('world', NovelWorldPage),
    createNovelFeatureRoute('role', NovelRolePage),
    createNovelFeatureRoute('creature', NovelCreaturePage),
    createNovelFeatureRoute('item', NovelItemPage),
    createNovelFeatureRoute('level', NovelLevelPage),
    createNovelFeatureRoute('timeline', NovelTimelinePage),
    createNovelFeatureRoute('outline', NovelOutlinePage),
    createNovelFeatureRoute('chapters', NovelChaptersPage),
    createNovelFeatureRoute('template', NovelTemplatePage),
    createNovelFeatureRoute('skills', NovelSkillsPage),
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
