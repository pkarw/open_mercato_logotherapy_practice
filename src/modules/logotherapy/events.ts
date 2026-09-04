import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'logotherapy.visit.created', label: 'Logotherapy visit created', category: 'crud' },
  { id: 'logotherapy.visit.updated', label: 'Logotherapy visit updated', category: 'crud' },
  { id: 'logotherapy.visit.deleted', label: 'Logotherapy visit deleted', category: 'crud' },
  { id: 'logotherapy.visit.cancelled', label: 'Logotherapy visit cancelled', category: 'lifecycle' },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'logotherapy', events })
export const emitLogotherapyEvent = eventsConfig.emit
export default eventsConfig
