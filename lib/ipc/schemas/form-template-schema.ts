import { z } from 'zod'

export const formTemplateFieldSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  component: z.string().optional(),
  required: z.boolean().optional(),
  multiple: z.boolean().optional(),
  allowCreate: z.boolean().optional(),
  options: z.array(z.unknown()).optional(),
  section: z.string().optional(),
  placeholder: z.string().optional(),
  rows: z.number().optional(),
  defaultValue: z.unknown().optional(),
})

export type FormFieldDef = z.infer<typeof formTemplateFieldSchema>

const fieldsArray = z.object({ fields: z.array(formTemplateFieldSchema) })
const detailFields = z.object({ detailFields: z.array(formTemplateFieldSchema) })
const extraFields = z.object({ extraFields: z.array(formTemplateFieldSchema).optional() })

export const formTemplateConfigSchema = z.object({
  overview: fieldsArray,
  role: detailFields.extend({
    relation: extraFields.optional(),
    timeline: extraFields.optional(),
  }),
  level: z.object({ levelFields: z.array(formTemplateFieldSchema) }),
  world: z.object({
    defaultDetailFields: z.array(formTemplateFieldSchema),
    timeline: extraFields.optional(),
  }),
  timeline: extraFields,
  outline: z.object({
    volumeFields: z.array(formTemplateFieldSchema),
    chapterSegmentFields: z.array(formTemplateFieldSchema),
  }),
  item: detailFields.extend({ timeline: extraFields.optional() }),
  creature: detailFields.extend({ timeline: extraFields.optional() }),
})

export type FormTemplateConfig = z.infer<typeof formTemplateConfigSchema>
export type FormTemplateSectionKey = keyof FormTemplateConfig

export const formTemplateGetArgs = z.object({ novelId: z.string() })
export const formTemplateGetReturn = formTemplateConfigSchema

export const formTemplateUpdateArgs = z.object({
  novelId: z.string(),
  config: formTemplateConfigSchema,
})
export const formTemplateUpdateReturn = formTemplateConfigSchema

export const overviewClearArgs = z.object({ novelId: z.string() })
export const overviewClearReturn = z.object({ ok: z.literal(true) })

export function emptyFormTemplateConfig(): FormTemplateConfig {
  return {
    overview: { fields: [] },
    role: { detailFields: [] },
    level: { levelFields: [] },
    world: { defaultDetailFields: [] },
    timeline: { extraFields: [] },
    outline: { volumeFields: [], chapterSegmentFields: [] },
    item: { detailFields: [] },
    creature: { detailFields: [] },
  }
}
