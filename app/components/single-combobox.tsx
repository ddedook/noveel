'use client'

import { useMemo } from 'react'
import { ComboBox, Input, ListBox } from '@heroui/react'
import { cn } from '@/app/lib/utils'

export type ComboboxOption = { label: string; value: string; disabled?: boolean }
export type ComboboxOptionGroup = { label: string; options: ComboboxOption[] }

type FlatOption = ComboboxOption & { group?: string }

function flattenOptions(options: ComboboxOption[] | ComboboxOptionGroup[]): FlatOption[] {
  if (options.length === 0) return []
  const first = options[0]
  if (first && 'options' in first) {
    return (options as ComboboxOptionGroup[]).flatMap((g) =>
      g.options.map((o) => ({ ...o, group: g.label })),
    )
  }
  return options as ComboboxOption[]
}

function mergeMissingOptions(flat: FlatOption[], value: unknown): FlatOption[] {
  const known = new Set(flat.map((o) => o.value))
  const extras: FlatOption[] = []
  const values = Array.isArray(value) ? value : value != null && value !== '' ? [value] : []
  for (const v of values) {
    const s = String(v).trim()
    if (!s || known.has(s)) continue
    known.add(s)
    extras.push({ label: s, value: s, group: '当前值' })
  }
  return extras.length ? [...flat, ...extras] : flat
}

export function SingleCombobox(props: {
  value: string | null | undefined
  onValueChange: (value: string) => void
  options: ComboboxOption[] | ComboboxOptionGroup[]
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  'aria-invalid'?: boolean
  contentClassName?: string
  emptyText?: string
}) {
  const {
    value,
    onValueChange,
    options,
    placeholder,
    disabled,
    className,
    id,
    'aria-invalid': ariaInvalid,
    emptyText = '无匹配项',
  } = props

  const flatOptions = useMemo(
    () => mergeMissingOptions(flattenOptions(options), value),
    [options, value],
  )

  const labelByValue = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of flatOptions) {
      map.set(o.value, o.group ? `${o.group} · ${o.label}` : o.label)
    }
    return map
  }, [flatOptions])

  const disabledValues = useMemo(
    () => new Set(flatOptions.filter((o) => o.disabled).map((o) => o.value)),
    [flatOptions],
  )

  const strVal = value != null && value !== '' ? String(value) : null

  return (
    <ComboBox
      className={cn('w-full', className)}
      isDisabled={disabled}
      selectedKey={strVal}
      onSelectionChange={(key) => {
        if (key == null) return
        const next = String(key)
        if (disabledValues.has(next)) return
        onValueChange(next)
      }}
    >
      <ComboBox.InputGroup>
        <Input
          id={id}
          aria-invalid={ariaInvalid || undefined}
          placeholder={placeholder ?? '请选择…'}
        />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox
          renderEmptyState={() => (
            <div className="text-muted px-3 py-2 text-sm">{emptyText}</div>
          )}
        >
          {flatOptions.map((o) => (
            <ListBox.Item
              key={o.value}
              id={o.value}
              textValue={labelByValue.get(o.value) ?? o.label}
              isDisabled={o.disabled}
            >
              {labelByValue.get(o.value) ?? o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  )
}
