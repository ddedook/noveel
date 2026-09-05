import type { ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  Button,
  Input,
} from '@heroui/react'
import { EmptyState } from '@/app/components/empty-state'

type ManageTreeSidebarProps = {
  onAdd: () => void
  onClear?: () => void
  addLabel?: string
  showFilter?: boolean
  filterText?: string
  onFilterTextChange?: (value: string) => void
  isEmpty?: boolean
  isFilteredEmpty?: boolean
  children: ReactNode
}

export function ManageTreeSidebar({
  onAdd,
  onClear,
  addLabel = '添加',
  showFilter,
  filterText = '',
  onFilterTextChange,
  isEmpty,
  isFilteredEmpty,
  children,
}: ManageTreeSidebarProps) {
  return (
    <div className="flex w-56 shrink-0 flex-col gap-2 border-r border-border pr-3">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          isIconOnly
          className="h-8 w-8"
          aria-label={addLabel}
          onPress={onAdd}
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        {onClear ? (
          <AlertDialog>
            <AlertDialog.Trigger>
              <Button
                type="button"
                variant="ghost"
                isIconOnly
                className="h-8 w-8 text-danger"
                aria-label="清空"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </AlertDialog.Trigger>
            <AlertDialog.Backdrop>
              <AlertDialog.Container className="app-no-drag">
                <AlertDialog.Dialog>
                  <AlertDialog.Header>
                    <AlertDialog.Heading>清空全部？</AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body>
                    <p className="text-muted text-sm">此操作不可撤销。</p>
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button variant="outline" slot="close">
                      取消
                    </Button>
                    <Button variant="danger" onPress={onClear}>
                      清空
                    </Button>
                  </AlertDialog.Footer>
                </AlertDialog.Dialog>
              </AlertDialog.Container>
            </AlertDialog.Backdrop>
          </AlertDialog>
        ) : null}
      </div>
      {showFilter ? (
        <Input
          placeholder="搜索…"
          value={filterText}
          className="h-8"
          onChange={(e) => onFilterTextChange?.(e.target.value)}
        />
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        {isFilteredEmpty ? (
          <EmptyState
            className="p-4"
            title="无匹配结果"
            description="尝试调整搜索关键词"
          />
        ) : isEmpty ? (
          <EmptyState
            className="p-4"
            title="暂无数据"
            description="点击 + 添加第一条记录"
          />
        ) : (
          children
        )}
      </div>
    </div>
  )
}
