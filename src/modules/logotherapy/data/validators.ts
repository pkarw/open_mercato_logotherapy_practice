import { z } from 'zod'

export const therapyTypeSchema = z.enum(['logotherapy', 'sensory_integration'])
export const visitStatusSchema = z.enum(['scheduled', 'confirmed', 'completed', 'cancelled'])

const baseVisitSchema = z.object({
  customerId: z.string().uuid(),
  employeeId: z.string().uuid(),
  resourceId: z.string().uuid(),
  // Kept as a compatibility alias for early callers. The persisted value is
  // always the `therapy_type` custom field below.
  therapyType: therapyTypeSchema.optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  status: visitStatusSchema.default('scheduled'),
  notes: z.string().max(10000).nullable().optional(),
})

export const visitCreateSchema = baseVisitSchema
export const visitUpdateSchema = baseVisitSchema.partial().extend({
  id: z.string().uuid(),
  updatedAt: z.string().min(1).optional(),
})
export const visitListSchema = z.object({
  id: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  therapyType: therapyTypeSchema.optional(),
  cf_therapy_type: therapyTypeSchema.optional(),
  status: visitStatusSchema.optional(),
  startFrom: z.coerce.date().optional(),
  startTo: z.coerce.date().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('start_at'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
})

export type VisitCreateInput = z.infer<typeof visitCreateSchema>
export type VisitUpdateInput = z.infer<typeof visitUpdateSchema>
