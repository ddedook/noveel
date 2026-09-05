import { Input, Label } from '@heroui/react'

export function isValidTimePoint(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v) && Number.isInteger(v)
}

export function TimelineTimePointField(props: {
  value: number | null
  onChange: (v: number | null) => void
  autoFocus?: boolean
  label?: string
}) {
  const { value, onChange, autoFocus, label = '排序时间点' } = props
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        step={1}
        value={value ?? ''}
        placeholder="如：20240101"
        autoFocus={autoFocus}
        onChange={(e) => {
          const raw = e.target.value.trim()
          if (!raw) {
            onChange(null)
            return
          }
          const n = Number.parseInt(raw, 10)
          onChange(Number.isFinite(n) ? n : null)
        }}
      />
      <p className="text-muted text-xs">有符号整数，越大越靠后；推荐 YYYYMMDD</p>
    </div>
  )
}
