import { cn } from '@/app/lib/utils'

export type EntityTreeNode = {
  key: string
  label: string
  children?: EntityTreeNode[]
  depth?: number
}

type EntityTreeProps = {
  nodes: EntityTreeNode[]
  selectedKey: string | null
  onSelect: (key: string) => void
}

function TreeRows({
  nodes,
  selectedKey,
  onSelect,
  depth = 0,
}: EntityTreeProps & { depth?: number }) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.key}>
          <button
            type="button"
            className={cn(
              'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-[background-color,transform] hover:bg-default active:scale-[0.96]',
              selectedKey === node.key && 'bg-default font-medium',
            )}
            style={{ paddingLeft: `${String(8 + depth * 12)}px` }}
            onClick={() => onSelect(node.key)}
          >
            <span className="truncate">{node.label}</span>
          </button>
          {node.children?.length ? (
            <TreeRows
              nodes={node.children}
              selectedKey={selectedKey}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ) : null}
        </div>
      ))}
    </>
  )
}

export function EntityTree({ nodes, selectedKey, onSelect }: EntityTreeProps) {
  if (nodes.length === 0) {
    return <p className="text-muted px-2 py-4 text-xs">暂无数据</p>
  }
  return <TreeRows nodes={nodes} selectedKey={selectedKey} onSelect={onSelect} />
}
