import { ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { cn } from '@/app/lib/utils'

type SegmentedOption<T extends string> = { value: T; label: string }

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'default',
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  size?: 'sm' | 'default'
  className?: string
}) {
  return (
    <ToggleButtonGroup
      selectionMode="single"
      selectedKeys={new Set([value])}
      size={size === 'sm' ? 'sm' : 'md'}
      className={cn('inline-flex', className)}
      onSelectionChange={(keys) => {
        const next = [...keys][0]
        if (next != null) onChange(String(next) as T)
      }}
    >
      {options.map((opt, i) => (
        <ToggleButton key={opt.value} id={opt.value} className={size === 'sm' ? 'flex-1 px-2 text-xs' : undefined}>
          {i > 0 ? <ToggleButtonGroup.Separator /> : null}
          {opt.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
