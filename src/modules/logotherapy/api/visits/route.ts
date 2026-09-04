import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { buildCustomFieldFiltersFromQuery, extractAllCustomFieldEntries } from '@open-mercato/shared/lib/crud/custom-fields'
import { parseWithCustomFields } from '@open-mercato/shared/lib/commands/helpers'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { LogotherapyVisit } from '../../data/entities'
import { visitCreateSchema, visitListSchema, visitUpdateSchema } from '../../data/validators'
import { openApi } from '../openapi'
import '../../commands/visits'

const ENTITY_ID = E.logotherapy.logotherapy_visit
const rawBodySchema = z.object({}).passthrough()

function withCustomFields(schema: typeof visitCreateSchema | typeof visitUpdateSchema, raw: unknown) {
  const { parsed, custom } = parseWithCustomFields(schema, raw)
  return { ...parsed, ...Object.fromEntries(Object.entries(custom).map(([key, value]) => [`cf_${key}`, value])) }
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  return null
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['logotherapy.view'] },
    POST: { requireAuth: true, requireFeatures: ['logotherapy.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['logotherapy.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['logotherapy.manage'] },
  },
  orm: { entity: LogotherapyVisit, idField: 'id', tenantField: 'tenantId', orgField: 'organizationId', softDeleteField: 'deletedAt' },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: visitListSchema,
    entityId: ENTITY_ID,
    fields: [
      'id', 'customer_id', 'customer_snapshot', 'employee_id', 'employee_snapshot',
      'resource_id', 'resource_snapshot', 'start_at', 'end_at', 'status',
      'notes', 'updated_at', 'tenant_id', 'organization_id', 'cf:therapy_type',
    ],
    sortFieldMap: { id: 'id', start_at: 'start_at', end_at: 'end_at', status: 'status', updated_at: 'updated_at' },
    buildFilters: async (query, ctx) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = query.id
      if (query.customerId) filters.customer_id = query.customerId
      if (query.employeeId) filters.employee_id = query.employeeId
      if (query.resourceId) filters.resource_id = query.resourceId
      if (query.status) filters.status = query.status
      if (query.startFrom || query.startTo) filters.start_at = { ...(query.startFrom ? { $gte: query.startFrom } : {}), ...(query.startTo ? { $lte: query.startTo } : {}) }
      if (query.cf_therapy_type) {
        const custom = await buildCustomFieldFiltersFromQuery({
          entityId: ENTITY_ID,
          query: { cf_therapy_type: query.cf_therapy_type },
          em: ctx.container.resolve('em'),
          tenantId: ctx.auth?.tenantId,
        })
        Object.assign(filters, custom)
      }
      return filters
    },
    transformItem: (item) => ({
      ...item,
      updatedAt: iso(item.updated_at),
      startAt: iso(item.start_at),
      endAt: iso(item.end_at),
      ...extractAllCustomFieldEntries(item as Record<string, unknown>),
    }),
  },
  actions: {
    create: { commandId: 'logotherapy.visits.create', schema: rawBodySchema, mapInput: ({ raw }) => withCustomFields(visitCreateSchema, raw), response: ({ result }) => result, status: 201 },
    update: { commandId: 'logotherapy.visits.update', schema: rawBodySchema, mapInput: ({ raw }) => withCustomFields(visitUpdateSchema, raw), response: ({ result }) => result },
    delete: { commandId: 'logotherapy.visits.delete', schema: rawBodySchema, response: ({ result }) => result },
  },
})

export { openApi }
