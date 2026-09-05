import { useQuery } from '@tanstack/react-query'
import type { FormFieldDef, FormTemplateSectionKey } from '@/lib/ipc/schemas/form-template-schema'

function fieldsForSection(
  config: Awaited<ReturnType<typeof window.ipcApi.formTemplate.get>>,
  section: FormTemplateSectionKey,
  sub?: string,
): FormFieldDef[] {
  switch (section) {
    case 'overview':
      return config.overview.fields
    case 'role':
      if (sub === 'relation') return config.role.relation?.extraFields ?? []
      if (sub === 'timeline') return config.role.timeline?.extraFields ?? []
      return config.role.detailFields
    case 'world':
      if (sub === 'timeline') return config.world.timeline?.extraFields ?? []
      return config.world.defaultDetailFields
    case 'creature':
      if (sub === 'timeline') return config.creature.timeline?.extraFields ?? []
      return config.creature.detailFields
    case 'item':
      if (sub === 'timeline') return config.item.timeline?.extraFields ?? []
      return config.item.detailFields
    case 'level':
      return config.level.levelFields
    case 'timeline':
      return config.timeline.extraFields ?? []
    case 'outline':
      return sub === 'chapter' ? config.outline.chapterSegmentFields : config.outline.volumeFields
    default:
      return []
  }
}

export function useFormTemplateFields(
  novelId: string | undefined,
  section: FormTemplateSectionKey,
  sub?: string,
) {
  const query = useQuery({
    queryKey: ['formTemplate', novelId],
    queryFn: () => window.ipcApi.formTemplate.get({ novelId: novelId! }),
    enabled: Boolean(novelId),
  })

  return {
    ...query,
    fields: query.data ? fieldsForSection(query.data, section, sub) : [],
  }
}
