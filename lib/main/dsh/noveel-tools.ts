import { getNovelContext } from '@/lib/main/novel/novel-context'
import type { EntityDomain } from '@/lib/main/novel/data/entity-types'
import { describeDomain, queryEntities, getEntities, mutateEntities } from '@/lib/main/novel/data/entity-repo'
import { importVendorModule } from '@/lib/main/dsh/vendor-module-paths'

type HostContext = {
  tools: { register: (tool: unknown) => void }
  on: (
    event: 'system-prompt/assemble',
    handler: (
      assembly: { contexts: { name: string; text: string }[] },
      context: unknown,
      next: () => Promise<{ contexts: { name: string; text: string }[] } & Record<string, unknown>>,
    ) => Promise<{ contexts: { name: string; text: string }[] } & Record<string, unknown>>,
  ) => void
}

function jsonRender(value: unknown) {
  return [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
}

export async function registerNoveelTools(ctx: HostContext): Promise<void> {
  const { defineTool } = await importVendorModule<{
    defineTool: (options: Record<string, unknown>) => unknown
  }>('@deepseek-ai/dsh-tools')

  ctx.tools.register(
    defineTool({
      name: 'describe_schema',
      description: 'Describe noveel entity domains',
      parameters: {
        domain: { type: 'string' },
      },
      output: {
        schema: { type: 'json' },
        render: (_args: unknown, value: unknown) => jsonRender(value),
      },
      async execute(args: { domain?: string }) {
        const { novelId } = getNovelContext()
        return describeDomain(args.domain as EntityDomain | undefined, novelId ?? undefined)
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'query_entities',
      description: 'Query entities in current novel',
      parameters: {
        domain: { type: 'string', required: true },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
      output: {
        schema: { type: 'json' },
        render: (_args: unknown, value: unknown) => jsonRender(value),
      },
      async execute(args: { domain: string; limit?: number; offset?: number }) {
        const { novelId } = getNovelContext()
        if (!novelId) throw new Error('No novel selected')
        return queryEntities(novelId, {
          domain: args.domain as EntityDomain,
          limit: args.limit,
          offset: args.offset,
        })
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'get_entities',
      description: 'Get entities by ids or names',
      parameters: {
        domain: { type: 'string', required: true },
        ids: { type: 'array', items: { type: 'string' } },
        names: { type: 'array', items: { type: 'string' } },
      },
      output: {
        schema: { type: 'json' },
        render: (_args: unknown, value: unknown) => jsonRender(value),
      },
      async execute(args: {
        domain: string
        ids?: string[]
        names?: string[]
      }) {
        const { novelId } = getNovelContext()
        if (!novelId) throw new Error('No novel selected')
        return getEntities(novelId, {
          domain: args.domain as EntityDomain,
          ids: args.ids,
          names: args.names,
        })
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'mutate_entities',
      description: 'Create/update/delete entities',
      parameters: {
        ops: { type: 'json', required: true },
      },
      output: {
        schema: { type: 'json' },
        render: (_args: unknown, value: unknown) => jsonRender(value),
      },
      async execute(args: { ops: Parameters<typeof mutateEntities>[1] }) {
        const { novelId } = getNovelContext()
        if (!novelId) throw new Error('No novel selected')
        return mutateEntities(novelId, args.ops)
      },
    }),
  )

  ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const result = await next()
    const { novelId, page } = getNovelContext()
    if (!novelId) return result
    return {
      ...result,
      contexts: [
        ...result.contexts,
        {
          name: 'noveel',
          text: `novelId: ${novelId}\npage: ${page ?? 'overview'}`,
        },
      ],
    }
  })
}
