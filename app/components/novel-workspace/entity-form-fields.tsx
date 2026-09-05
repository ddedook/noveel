'use client'

import type { ReactNode } from 'react'
import type { Control, FieldValues, Path } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import {
  ErrorMessage,
  Input,
  Label,
  Switch,
  TextArea,
} from '@heroui/react'
import { SingleCombobox } from '@/app/components/single-combobox'
import type { FormFieldDef } from '@/lib/ipc/schemas/form-template-schema'
import { TemplateMultiCombobox, TemplateSingleCombobox } from '@/app/components/novel-workspace/template-combobox'
import { cn } from '@/app/lib/utils'

type ScalarFieldDef = {
  key: string
  label?: string
  component?: string
  required?: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string }>
}

function FieldShell(props: {
  id?: string
  className?: string
  invalid?: boolean
  label: string
  error?: { message?: string }
  children: ReactNode
}) {
  const { id, className, invalid, label, error, children } = props
  return (
    <div className={cn('flex flex-col gap-1.5', className)} data-invalid={invalid || undefined}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error?.message ? <ErrorMessage>{error.message}</ErrorMessage> : null}
    </div>
  )
}

export function EntityScalarFields<T extends FieldValues>(props: {
  control: Control<T>
  fields: ScalarFieldDef[]
}) {
  const { control, fields } = props

  return (
    <div className="flex flex-col gap-4">
      {fields.map((def) => (
        <Controller
          key={def.key}
          control={control}
          name={def.key as Path<T>}
          render={({ field, fieldState }) => (
            <FieldShell
              id={def.key}
              invalid={fieldState.invalid}
              label={def.label ?? def.key}
              error={fieldState.error}
            >
              {def.component === 'textarea' ? (
                <TextArea
                  id={def.key}
                  aria-invalid={fieldState.invalid}
                  placeholder={def.placeholder}
                  value={String(field.value ?? '')}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              ) : def.component === 'switch' ? (
                <Switch
                  isSelected={Boolean(field.value)}
                  onChange={field.onChange}
                  aria-invalid={fieldState.invalid}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              ) : def.component === 'select' && def.options?.length ? (
                <SingleCombobox
                  id={def.key}
                  aria-invalid={fieldState.invalid}
                  value={String(field.value ?? '')}
                  placeholder={def.placeholder ?? '请选择'}
                  className="w-full"
                  onValueChange={field.onChange}
                  options={def.options}
                />
              ) : (
                <Input
                  id={def.key}
                  aria-invalid={fieldState.invalid}
                  placeholder={def.placeholder}
                  value={field.value != null ? String(field.value) : ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            </FieldShell>
          )}
        />
      ))}
    </div>
  )
}

export function EntityTemplateFieldsRhf<T extends FieldValues>(props: {
  control: Control<T>
  fields: FormFieldDef[]
  namePrefix?: string
  readOnly?: boolean
}) {
  const { control, fields, namePrefix = '', readOnly } = props

  return (
    <div className="flex flex-col gap-4">
      {fields.map((def) => {
        const name = (namePrefix ? `${namePrefix}.${def.key}` : def.key) as Path<T>
        const component = def.component ?? 'textarea'
        const label = def.label ?? def.key

        return (
          <Controller
            key={def.key}
            control={control}
            name={name}
            render={({ field, fieldState }) => (
              <FieldShell
                id={def.key}
                invalid={fieldState.invalid}
                label={label}
                error={fieldState.error}
                className={component === 'textarea' ? 'sm:col-span-2' : undefined}
              >
                {component === 'switch' ? (
                  <Switch
                    isSelected={Boolean(field.value)}
                    isDisabled={readOnly}
                    onChange={field.onChange}
                    aria-invalid={fieldState.invalid}
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                ) : component === 'inputNumber' ? (
                  <Input
                    id={def.key}
                    type="number"
                    disabled={readOnly}
                    aria-invalid={fieldState.invalid}
                    value={field.value != null && field.value !== '' ? String(field.value) : ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim()
                      field.onChange(raw === '' ? null : Number(raw))
                    }}
                  />
                ) : component === 'tagInput' ? (
                  <TemplateMultiCombobox
                    label={undefined}
                    disabled={readOnly}
                    allowCreate={def.allowCreate}
                    options={(def.options ?? []) as Array<{ label: string; value: string }>}
                    value={Array.isArray(field.value) ? field.value.map(String) : []}
                    onChange={field.onChange}
                    placeholder={def.placeholder}
                  />
                ) : component === 'select' ? (
                  def.multiple ? (
                    <TemplateMultiCombobox
                      label={undefined}
                      disabled={readOnly}
                      allowCreate={def.allowCreate}
                      options={(def.options ?? []) as Array<{ label: string; value: string }>}
                      value={Array.isArray(field.value) ? field.value.map(String) : []}
                      onChange={field.onChange}
                      placeholder={def.placeholder}
                    />
                  ) : (
                    <TemplateSingleCombobox
                      label={undefined}
                      disabled={readOnly}
                      options={(def.options ?? []) as Array<{ label: string; value: string }>}
                      value={field.value != null ? String(field.value) : null}
                      onChange={field.onChange}
                      placeholder={def.placeholder}
                    />
                  )
                ) : component === 'input' || component === 'text' ? (
                  <Input
                    id={def.key}
                    disabled={readOnly}
                    aria-invalid={fieldState.invalid}
                    placeholder={def.placeholder}
                    value={field.value != null ? String(field.value) : ''}
                    onChange={field.onChange}
                  />
                ) : (
                  <TextArea
                    id={def.key}
                    disabled={readOnly}
                    aria-invalid={fieldState.invalid}
                    placeholder={def.placeholder}
                    rows={def.rows ?? 4}
                    value={field.value != null ? String(field.value) : ''}
                    onChange={field.onChange}
                  />
                )}
              </FieldShell>
            )}
          />
        )
      })}
    </div>
  )
}
