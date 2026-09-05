'use client'

import { useMemo } from 'react'
import { Chip, ComboBox, Input, Label, ListBox } from '@heroui/react'
import { cn } from '@/app/lib/utils'
import type { ComboboxOption, ComboboxOptionGroup } from '@/app/components/single-combobox'
import { SingleCombobox } from '@/app/components/single-combobox'

export type { ComboboxOption, ComboboxOptionGroup }

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

export function TemplateMultiCombobox(props: {
  label?: string
  placeholder?: string
  options?: ComboboxOption[] | ComboboxOptionGroup[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  allowCreate?: boolean
  className?: string
}) {
  const { label, placeholder, options = [], value, onChange, disabled, allowCreate, className } = props

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

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? <Label>{label}</Label> : null}
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {value.map((item) => (
            <Chip key={item} size="sm" variant="secondary">
              {labelByValue.get(item) ?? item}
            </Chip>
          ))}
        </div>
      ) : null}
      <ComboBox
        className="w-full"
        selectionMode="multiple"
        isDisabled={disabled}
        value={value}
        allowsCustomValue={allowCreate}
        onChange={(keys) => {
          onChange(Array.from(keys as Iterable<string>, String))
        }}
      >
        <ComboBox.InputGroup className="w-full">
          <Input className="w-full" placeholder={placeholder ?? '选择或输入…'} />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox
            renderEmptyState={() => (
              <div className="text-muted px-3 py-2 text-sm">
                {allowCreate ? '无匹配项，可直接输入' : '无匹配项'}
              </div>
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
    </div>
  )
}

export function TemplateSingleCombobox(props: {
  label?: string
  placeholder?: string
  options?: ComboboxOption[] | ComboboxOptionGroup[]
  value: string | null | undefined
  onChange: (value: string | null) => void
  disabled?: boolean
  className?: string
}) {
  const { label, placeholder, options = [], value, onChange, disabled, className } = props

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? <Label>{label}</Label> : null}
      <SingleCombobox
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        options={options}
        onValueChange={(next) => onChange(next !== '' ? next : null)}
      />
    </div>
  )
}
