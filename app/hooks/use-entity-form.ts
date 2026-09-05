import { useMemo } from 'react'
import { useForm, type DefaultValues, type FieldValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { FormFieldDef } from '@/lib/ipc/schemas/form-template-schema'
import { getByPath } from '@/app/lib/form-path'

type ScalarField = {
  key: string
  label?: string
  required?: boolean
  component?: string
}

function zodForTemplateField(def: FormFieldDef): z.ZodTypeAny {
  const label = def.label ?? def.key
  switch (def.component) {
    case 'switch':
      return def.required ? z.boolean() : z.boolean().optional()
    case 'inputNumber':
      return def.required
        ? z.number({ message: `请填写${label}` })
        : z.number().nullable().optional()
    case 'tagInput':
    case 'select':
      if (def.multiple) {
        return def.required
          ? z.array(z.string()).min(1, `请填写${label}`)
          : z.array(z.string()).optional()
      }
      return def.required ? z.string().min(1, `请填写${label}`) : z.string().optional()
    default:
      return def.required ? z.string().min(1, `请填写${label}`) : z.string().optional()
  }
}

function zodForScalarField(def: ScalarField): z.ZodTypeAny {
  const label = def.label ?? def.key
  switch (def.component) {
    case 'switch':
      return def.required ? z.boolean() : z.boolean().optional()
    case 'inputNumber':
      return def.required
        ? z.number({ message: `请填写${label}` })
        : z.number().nullable().optional()
    default:
      return def.required ? z.string().min(1, `请填写${label}`) : z.string().optional()
  }
}

function buildSchema(
  templateFields: FormFieldDef[],
  scalars: ScalarField[],
  namePrefix = '',
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const s of scalars) {
    shape[s.key] = zodForScalarField(s)
  }
  for (const f of templateFields) {
    const parts = f.key.split('.')
    if (parts.length === 1) {
      shape[f.key] = zodForTemplateField(f)
    } else {
      // nested paths validated at leaf via superRefine on submit if needed
      shape[parts[0]!] = z.record(z.string(), z.unknown()).optional()
    }
  }
  void namePrefix
  return z.object(shape)
}

export function useEntityForm<T extends FieldValues>(options: {
  templateFields?: FormFieldDef[]
  scalars?: ScalarField[]
  defaultValues: DefaultValues<T>
}) {
  const { templateFields = [], scalars = [], defaultValues } = options

  const schema = useMemo(
    () => buildSchema(templateFields, scalars),
    [templateFields, scalars],
  )

  const form = useForm<T>({
    resolver: zodResolver(schema) as never,
    defaultValues,
    mode: 'onSubmit',
  })

  return form
}

export function pickFormValues<T extends Record<string, unknown>>(
  data: T,
  templateFields: FormFieldDef[],
  scalars: ScalarField[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const s of scalars) {
    out[s.key] = data[s.key]
  }
  for (const f of templateFields) {
    out[f.key] = getByPath(data, f.key)
  }
  return out
}
