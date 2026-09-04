import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { installCustomEntitiesFromModules } from '@open-mercato/core/modules/entities/lib/install-from-ce'
import type { EntityManager } from '@mikro-orm/postgresql'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['logotherapy.*'],
    admin: ['logotherapy.*'],
    employee: ['logotherapy.view'],
  },
  async onTenantCreated({ em, tenantId }) {
    await installCustomEntitiesFromModules(em, null, {
      entityIds: ['logotherapy:logotherapy_visit'],
      tenantIds: [tenantId],
      includeGlobal: false,
    })
  },
  async seedDefaults({ em, tenantId, organizationId }) {
    // Room resources are owned by the Resources module. This setup hook delegates
    // room creation through its command only after the phase-1 integration seam is
    // resolved; it never creates a duplicate app-owned room table.
    void (em as EntityManager)
    void tenantId
    void organizationId
  },
}

export default setup
