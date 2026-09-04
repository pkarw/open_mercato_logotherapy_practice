import { z } from 'zod'
import { createCrudOpenApiFactory, createPagedListResponseSchema } from '@open-mercato/shared/lib/openapi/crud'

const build = createCrudOpenApiFactory({ defaultTag: 'Logotherapy' })
const item = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  employeeId: z.string().uuid(),
  resourceId: z.string().uuid(),
  therapyType: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.string(),
  updatedAt: z.string().nullable().optional(),
}).passthrough()

export const openApi = build({
  resourceName: 'Logotherapy visit',
  pluralName: 'Logotherapy visits',
  querySchema: z.object({ page: z.coerce.number().optional(), pageSize: z.coerce.number().optional() }).passthrough(),
  listResponseSchema: createPagedListResponseSchema(item),
  create: { schema: z.object({}).passthrough(), description: 'Create a logotherapy visit.' },
  update: { schema: z.object({ id: z.string().uuid() }).passthrough(), description: 'Update a logotherapy visit.' },
  del: { schema: z.object({ id: z.string().uuid() }), description: 'Cancel a logotherapy visit.' },
})
