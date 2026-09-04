import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/decorators/legacy'

@Entity({ tableName: 'logotherapy_visits' })
@Index({ name: 'logotherapy_visits_scope_time_idx', properties: ['tenantId', 'organizationId', 'startAt', 'endAt'] })
@Index({ name: 'logotherapy_visits_employee_time_idx', properties: ['tenantId', 'organizationId', 'employeeId', 'startAt', 'endAt'] })
@Index({ name: 'logotherapy_visits_resource_time_idx', properties: ['tenantId', 'organizationId', 'resourceId', 'startAt', 'endAt'] })
export class LogotherapyVisit {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'customer_id', type: 'uuid' })
  customerId!: string

  @Property({ name: 'customer_snapshot', type: 'json' })
  customerSnapshot!: Record<string, string | null>

  @Property({ name: 'employee_id', type: 'uuid' })
  employeeId!: string

  @Property({ name: 'employee_snapshot', type: 'json' })
  employeeSnapshot!: Record<string, string | null>

  @Property({ name: 'resource_id', type: 'uuid' })
  resourceId!: string

  @Property({ name: 'resource_snapshot', type: 'json' })
  resourceSnapshot!: Record<string, string | null>

  @Property({ name: 'start_at', type: Date })
  startAt!: Date

  @Property({ name: 'end_at', type: Date })
  endAt!: Date

  @Property({ type: 'text', default: 'scheduled' })
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' = 'scheduled'

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
