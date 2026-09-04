import type { CustomEntitySpec, CustomFieldDefinition } from '@open-mercato/shared/modules/entities'

const fields: CustomFieldDefinition[] = [
  {
    key: 'therapy_type',
    kind: 'select',
    label: 'Therapy type',
    options: [
      { value: 'logotherapy', label: 'Logotherapy' },
      { value: 'sensory_integration', label: 'Sensory Integration' },
    ],
    formEditable: true,
    filterable: true,
    required: true,
  },
]

export const entities: CustomEntitySpec[] = [{
  id: 'logotherapy:logotherapy_visit',
  label: 'Logotherapy visit',
  description: 'A scheduled therapy visit.',
  showInSidebar: false,
  fields,
}]

export default entities
