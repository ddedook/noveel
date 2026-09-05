'use client'

import { useMemo, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Button,
  Disclosure,
  Input,
  Label,
  Switch,
  TextArea,
} from '@heroui/react'
import type { FormFieldDef } from '@/lib/ipc/schemas/form-template-schema'
import { getByPath, setByPath, applyFieldDefaults as applyDefaults } from '@/app/lib/form-path'
import { TemplateMultiCombobox, TemplateSingleCombobox } from '@/app/components/novel-workspace/template-combobox'

type FlatSelectOption = { label: string; value: string }
type GroupedSelectOption = { label: string; options: FlatSelectOption[] }
type FormFieldOptions = FlatSelectOption[] | GroupedSelectOption[]

type Props = {
  fields: FormFieldDef[]
  value: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
  readOnly?: boolean
}

function isGroupedSelectOptions(opts: FormFieldOptions): opts is GroupedSelectOption[] {
  if (opts.length === 0) return false
  const first = opts[0]
  return first != null && 'options' in first && Array.isArray(first.options)
}

function toComboboxOptions(opts: FormFieldOptions): FlatSelectOption[] | GroupedSelectOption[] {
  return opts
}

function FieldBlock({
  def,
  value,
  onChange,
  readOnly,
}: {
  def: FormFieldDef
  value: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
  readOnly?: boolean
}) {
  const fieldVal = getByPath(value, def.key)
  const set = (v: unknown) => onChange(setByPath(value, def.key, v))
  const label = def.label ?? def.key
  const component = def.component ?? 'textarea'
  const opts = toComboboxOptions((def.options ?? []) as FormFieldOptions)

  const fieldShell = (control: ReactNode, horizontal = false) => (
    <div className="flex flex-col gap-1.5">
      {horizontal ? (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={def.key}>{label}</Label>
          {control}
        </div>
      ) : (
        <>
          <Label htmlFor={def.key}>{label}</Label>
          {control}
        </>
      )}
    </div>
  )

  switch (component) {
    case 'input':
    case 'text':
      return fieldShell(
        <Input
          id={def.key}
          className="w-full"
          value={fieldVal != null ? String(fieldVal) : ''}
          placeholder={def.placeholder}
          disabled={readOnly}
          onChange={(e) => set(e.target.value)}
        />,
      )
    case 'textarea':
      return fieldShell(
        <TextArea
          id={def.key}
          className="w-full"
          value={fieldVal != null ? String(fieldVal) : ''}
          placeholder={def.placeholder}
          disabled={readOnly}
          rows={def.rows ?? 4}
          onChange={(e) => set(e.target.value)}
        />,
      )
    case 'switch':
      return fieldShell(
        <Switch
          id={def.key}
          isSelected={Boolean(fieldVal)}
          isDisabled={readOnly}
          onChange={set}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>,
        true,
      )
    case 'inputNumber':
      return fieldShell(
        <Input
          id={def.key}
          type="number"
          className="w-full"
          value={fieldVal != null && fieldVal !== '' ? String(fieldVal) : ''}
          placeholder={def.placeholder}
          disabled={readOnly}
          onChange={(e) => {
            const raw = e.target.value.trim()
            set(raw === '' ? null : Number(raw))
          }}
        />,
      )
    case 'tagInput':
      return (
        <TemplateMultiCombobox
          label={label}
          disabled={readOnly}
          allowCreate={def.allowCreate}
          options={isGroupedSelectOptions(opts) ? opts : (opts as FlatSelectOption[])}
          value={Array.isArray(fieldVal) ? fieldVal.map(String) : fieldVal != null && fieldVal !== '' ? [String(fieldVal)] : []}
          onChange={(v) => set(v)}
          placeholder={def.placeholder}
        />
      )
    case 'select':
      if (def.multiple) {
        return (
          <TemplateMultiCombobox
            label={label}
            disabled={readOnly}
            allowCreate={def.allowCreate}
            options={isGroupedSelectOptions(opts) ? opts : (opts as FlatSelectOption[])}
            value={Array.isArray(fieldVal) ? fieldVal.map(String) : []}
            onChange={(v) => set(v)}
            placeholder={def.placeholder}
          />
        )
      }
      return (
        <TemplateSingleCombobox
          label={label}
          disabled={readOnly}
          options={isGroupedSelectOptions(opts) ? opts : (opts as FlatSelectOption[])}
          value={fieldVal != null && fieldVal !== '' ? String(fieldVal) : null}
          onChange={(v) => set(v)}
          placeholder={def.placeholder}
        />
      )
    default:
      return null
  }
}

export function DynamicTemplateFields({ fields, value, onChange, readOnly }: Props) {
  const bySection = useMemo(() => {
    const map = new Map<string, FormFieldDef[]>()
    const noSection: FormFieldDef[] = []
    for (const f of fields) {
      const s = f.section?.trim()
      if (!s) noSection.push(f)
      else {
        const list = map.get(s) ?? []
        list.push(f)
        map.set(s, list)
      }
    }
    return { map, noSection }
  }, [fields])

  const blocks: ReactNode[] = []

  if (bySection.noSection.length > 0) {
    blocks.push(
      <div key="__flat" className="grid gap-4 sm:grid-cols-2 sm:gap-x-4">
        {bySection.noSection.map((f) => (
          <div key={f.key} className={f.component === 'textarea' ? 'sm:col-span-2' : undefined}>
            <FieldBlock def={f} value={value} onChange={onChange} readOnly={readOnly} />
          </div>
        ))}
      </div>,
    )
  }

  for (const [title, list] of bySection.map.entries()) {
    blocks.push(
      <Disclosure key={title} defaultExpanded className="rounded-md border border-border">
        <Disclosure.Heading>
          <Button
            slot="trigger"
            variant="ghost"
            className="flex h-auto w-full items-center justify-between rounded-none px-3 py-2 text-sm font-medium hover:bg-default/50"
          >
            {title}
            <ChevronDown className="size-4 transition-transform duration-200 group-data-[expanded=true]/trigger:rotate-180" strokeWidth={1.5} />
          </Button>
        </Disclosure.Heading>
        <Disclosure.Content>
          <div className="grid gap-4 border-t border-border p-3 sm:grid-cols-2 sm:gap-x-4">
            {list.map((f) => (
              <div key={f.key} className={f.component === 'textarea' ? 'sm:col-span-2' : undefined}>
                <FieldBlock def={f} value={value} onChange={onChange} readOnly={readOnly} />
              </div>
            ))}
          </div>
        </Disclosure.Content>
      </Disclosure>,
    )
  }

  return <div className="flex flex-col gap-4">{blocks}</div>
}

export function applyFieldDefaults(values: Record<string, unknown>, fields: FormFieldDef[]): Record<string, unknown> {
  return applyDefaults(values, fields)
}
