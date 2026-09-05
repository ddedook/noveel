import { Label } from '@heroui/react'
import { SingleCombobox } from '@/app/components/single-combobox'
import { WORLD_NODE_KIND_GROUPS, WORLD_NODE_KIND_LABELS } from '@/app/lib/world-kinds'

export function WorldNodeKindSelect(props: {
  value: string
  onChange: (v: string) => void
  label?: string
  className?: string
  disabled?: boolean
}) {
  const { value, onChange, label = '节点类型', className, disabled } = props

  return (
    <div className={className}>
      <div className="flex flex-col gap-1.5">
        <Label>{label}</Label>
        <SingleCombobox
          value={value}
          disabled={disabled}
          placeholder="选择类型"
          className="w-full"
          onValueChange={onChange}
          options={WORLD_NODE_KIND_GROUPS.map((group) => ({
            label: group.label,
            options: group.kinds.map((kind) => ({
              value: kind,
              label: WORLD_NODE_KIND_LABELS[kind] ?? kind,
            })),
          }))}
        />
      </div>
    </div>
  )
}
