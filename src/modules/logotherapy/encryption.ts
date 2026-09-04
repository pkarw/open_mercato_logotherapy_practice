import type { ModuleEncryptionMap } from '@open-mercato/shared/modules/encryption'

export const defaultEncryptionMaps: ModuleEncryptionMap[] = [{
  entityId: 'logotherapy:logotherapy_visit',
  fields: [{ field: 'notes' }],
}]

export default defaultEncryptionMaps
