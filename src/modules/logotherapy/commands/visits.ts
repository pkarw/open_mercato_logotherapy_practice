import { LockMode } from '@mikro-orm/core'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import {
  emitCrudSideEffects,
  emitCrudUndoSideEffects,
  normalizeCustomFieldValues,
  parseWithCustomFields,
  requireId,
  setCustomFieldsIfAny,
} from '@open-mercato/shared/lib/commands/helpers'
import { buildCustomFieldResetMap, loadCustomFieldSnapshot } from '@open-mercato/shared/lib/commands/customFieldSnapshots'
import { extractUndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { conflict, notFound } from '@open-mercato/shared/lib/crud/errors'
import { enforceCommandOptimisticLock } from '@open-mercato/shared/lib/crud/optimistic-lock-command'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import { StaffTeamMember } from '@open-mercato/core/modules/staff/data/entities'
import { ResourcesResource } from '@open-mercato/core/modules/resources/data/entities'
import { LogotherapyVisit } from '../data/entities'
import { therapyTypeSchema, visitCreateSchema, visitUpdateSchema } from '../data/validators'

const ENTITY_ID = 'logotherapy:logotherapy_visit' as const
type Scope = { tenantId: string; organizationId: string }
type VisitInput = Record<string, unknown>
type VisitResult = { id: string; updatedAt: string }

type VisitSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  customerId: string
  customerSnapshot: Record<string, string | null>
  employeeId: string
  employeeSnapshot: Record<string, string | null>
  resourceId: string
  resourceSnapshot: Record<string, string | null>
  startAt: string
  endAt: string
  status: LogotherapyVisit['status']
  notes: string | null
  deletedAt: string | null
  custom?: Record<string, unknown>
}

type UndoPayload = { before?: VisitSnapshot; after?: VisitSnapshot }

const visitCrudEvents: CrudEventsConfig<LogotherapyVisit> = {
  module: 'logotherapy',
  entity: 'visit',
  persistent: true,
  buildPayload: ({ entity, identifiers, syncOrigin }) => ({
    id: identifiers.id,
    tenantId: identifiers.tenantId,
    organizationId: identifiers.organizationId,
    customerId: entity?.customerId ?? null,
    employeeId: entity?.employeeId ?? null,
    resourceId: entity?.resourceId ?? null,
    status: entity?.status ?? null,
    ...(syncOrigin ? { syncOrigin } : {}),
  }),
}

function ensureScope(ctx: CommandRuntimeContext): Scope {
  const tenantId = ctx.auth?.tenantId ?? null
  const organizationId = ctx.selectedOrganizationId ?? ctx.organizationScope?.selectedId ?? ctx.auth?.orgId ?? null
  if (!tenantId || !organizationId) throw conflict('A tenant and organization context are required')
  return { tenantId, organizationId }
}

function parseVisitCreate(raw: unknown) {
  const parsed = parseWithCustomFields(visitCreateSchema, raw)
  return normalizeParsedVisit(parsed.parsed, parsed.custom)
}

function parseVisitUpdate(raw: unknown) {
  const parsed = parseWithCustomFields(visitUpdateSchema, raw)
  return normalizeParsedVisit(parsed.parsed, parsed.custom)
}

function normalizeParsedVisit<T extends { therapyType?: string }>(parsed: T, custom: Record<string, unknown>) {
  const values = { ...custom }
  if (parsed.therapyType !== undefined && values.therapy_type === undefined) values.therapy_type = parsed.therapyType
  return { parsed, custom: values }
}

function requireTherapyType(custom: Record<string, unknown>, required: boolean): string | undefined {
  const value = custom.therapy_type
  if (value === undefined || value === null || value === '') {
    if (required) throw conflict('Therapy type is required')
    return undefined
  }
  const result = therapyTypeSchema.safeParse(value)
  if (!result.success) throw conflict('Unknown therapy type')
  return result.data
}

async function ensureReferences(
  em: EntityManager,
  input: { customerId: string; employeeId: string; resourceId: string },
  scope: Scope,
) {
  const [customer, employee, resource] = await Promise.all([
    findOneWithDecryption(em, CustomerEntity, { id: input.customerId, ...scope, isActive: true, deletedAt: null }, undefined, scope),
    findOneWithDecryption(em, StaffTeamMember, { id: input.employeeId, ...scope, isActive: true, deletedAt: null }, undefined, scope),
    findOneWithDecryption(em, ResourcesResource, { id: input.resourceId, ...scope, isActive: true, deletedAt: null }, undefined, scope),
  ])
  if (!customer || !employee || !resource) throw notFound('One or more selected records were not found')
  return {
    customerSnapshot: { id: customer.id, name: customer.displayName },
    employeeSnapshot: { id: employee.id, name: employee.displayName },
    resourceSnapshot: { id: resource.id, name: resource.name },
  }
}

async function assertAvailable(
  em: EntityManager,
  input: { employeeId: string; resourceId: string; startAt: Date; endAt: Date; id?: string },
  scope: Scope,
) {
  if (input.endAt <= input.startAt) throw conflict('Visit end must be after visit start')
  const found = await em.findOne(LogotherapyVisit, {
    ...scope,
    deletedAt: null,
    status: { $in: ['scheduled', 'confirmed'] },
    ...(input.id ? { id: { $ne: input.id } } : {}),
    $or: [
      { employeeId: input.employeeId, startAt: { $lt: input.endAt }, endAt: { $gt: input.startAt } },
      { resourceId: input.resourceId, startAt: { $lt: input.endAt }, endAt: { $gt: input.startAt } },
    ],
  } as FilterQuery<LogotherapyVisit>, { lockMode: LockMode.PESSIMISTIC_WRITE })
  if (found) throw conflict('The selected employee or room is already booked for this time')
}

async function loadVisit(em: EntityManager, id: string, scope: Scope) {
  return findOneWithDecryption(em, LogotherapyVisit, { id, ...scope, deletedAt: null }, undefined, scope)
}

async function snapshotVisit(em: EntityManager, id: string, scope: Scope): Promise<VisitSnapshot | null> {
  const visit = await findOneWithDecryption(em, LogotherapyVisit, { id, ...scope }, undefined, scope)
  if (!visit) return null
  const custom = await loadCustomFieldSnapshot(em, { entityId: ENTITY_ID, recordId: id, ...scope })
  return {
    id: visit.id,
    tenantId: visit.tenantId,
    organizationId: visit.organizationId,
    customerId: visit.customerId,
    customerSnapshot: visit.customerSnapshot,
    employeeId: visit.employeeId,
    employeeSnapshot: visit.employeeSnapshot,
    resourceId: visit.resourceId,
    resourceSnapshot: visit.resourceSnapshot,
    startAt: visit.startAt.toISOString(),
    endAt: visit.endAt.toISOString(),
    status: visit.status,
    notes: visit.notes ?? null,
    deletedAt: visit.deletedAt?.toISOString() ?? null,
    ...(Object.keys(custom).length ? { custom } : {}),
  }
}

function resultFor(record: LogotherapyVisit): VisitResult {
  return { id: record.id, updatedAt: record.updatedAt.toISOString() }
}

function identifiers(record: LogotherapyVisit, scope: Scope) {
  return { id: record.id, tenantId: scope.tenantId, organizationId: scope.organizationId }
}

async function restoreSnapshot(snapshot: VisitSnapshot, ctx: CommandRuntimeContext) {
  const scope = ensureScope(ctx)
  if (scope.tenantId !== snapshot.tenantId || scope.organizationId !== snapshot.organizationId) throw conflict('Undo scope does not match the visit')
  const em = ctx.container.resolve('em') as EntityManager
  const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
  let record = await em.findOne(LogotherapyVisit, { id: snapshot.id, ...scope } as FilterQuery<LogotherapyVisit>)
  const values = {
    id: snapshot.id,
    ...scope,
    customerId: snapshot.customerId,
    customerSnapshot: snapshot.customerSnapshot,
    employeeId: snapshot.employeeId,
    employeeSnapshot: snapshot.employeeSnapshot,
    resourceId: snapshot.resourceId,
    resourceSnapshot: snapshot.resourceSnapshot,
    startAt: new Date(snapshot.startAt),
    endAt: new Date(snapshot.endAt),
    status: snapshot.status,
    notes: snapshot.notes,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  if (!record) record = em.create(LogotherapyVisit, values)
  else Object.assign(record, values)
  await withAtomicFlush(em, [() => { em.persist(record!) }], { transaction: true, label: 'logotherapy.visit.undo' })
  const customValues = normalizeCustomFieldValues(buildCustomFieldResetMap(snapshot.custom, undefined))
  if (Object.keys(customValues).length) await dataEngine.setCustomFields({ entityId: ENTITY_ID, recordId: snapshot.id, ...scope, values: customValues, notify: false })
  await emitCrudUndoSideEffects({ dataEngine, action: 'updated', entity: record, identifiers: identifiers(record, scope), events: visitCrudEvents, syncOrigin: ctx.syncOrigin })
}

export const createVisit: CommandHandler<VisitInput, VisitResult> = {
  id: 'logotherapy.visits.create',
  isUndoable: true,
  async execute(raw, ctx) {
    const { parsed, custom } = parseVisitCreate(raw)
    const scope = ensureScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    requireTherapyType(custom, true)
    await assertAvailable(em, parsed, scope)
    const references = await ensureReferences(em, parsed, scope)
    const record = em.create(LogotherapyVisit, { ...scope, ...references, customerId: parsed.customerId, employeeId: parsed.employeeId, resourceId: parsed.resourceId, startAt: parsed.startAt, endAt: parsed.endAt, status: parsed.status, notes: parsed.notes ?? null, createdAt: new Date(), updatedAt: new Date() })
    await withAtomicFlush(em, [() => { em.persist(record) }], { transaction: true, label: 'logotherapy.visit.create' })
    await setCustomFieldsIfAny({ dataEngine, entityId: ENTITY_ID, recordId: record.id, ...scope, values: custom })
    await emitCrudSideEffects({ dataEngine, action: 'created', entity: record, identifiers: identifiers(record, scope), events: visitCrudEvents, syncOrigin: ctx.syncOrigin })
    return resultFor(record)
  },
  async captureAfter(_input, result, ctx) {
    return snapshotVisit(ctx.container.resolve('em') as EntityManager, result.id, ensureScope(ctx))
  },
  buildLog({ result, snapshots }) {
    const after = snapshots.after as VisitSnapshot | null | undefined
    return { actionLabel: 'Book therapy visit', resourceKind: ENTITY_ID, resourceId: result.id, tenantId: after?.tenantId ?? null, organizationId: after?.organizationId ?? null, snapshotAfter: after ?? null, payload: { undo: { after: after ?? undefined } satisfies UndoPayload } }
  },
  async undo({ logEntry, ctx }) {
    const payload = extractUndoPayload<UndoPayload>(logEntry)
    const snapshot = payload?.after ?? (logEntry.snapshotAfter as VisitSnapshot | null | undefined)
    if (!snapshot) return
    const scope = ensureScope(ctx)
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    const removed = await dataEngine.deleteOrmEntity({ entity: LogotherapyVisit, where: { id: snapshot.id, ...scope } as FilterQuery<LogotherapyVisit>, soft: true, softDeleteField: 'deletedAt' })
    const reset = normalizeCustomFieldValues(buildCustomFieldResetMap(undefined, snapshot.custom))
    if (Object.keys(reset).length) await dataEngine.setCustomFields({ entityId: ENTITY_ID, recordId: snapshot.id, ...scope, values: reset, notify: false })
    await emitCrudUndoSideEffects({ dataEngine, action: 'deleted', entity: removed, identifiers: { id: snapshot.id, ...scope }, events: visitCrudEvents, syncOrigin: ctx.syncOrigin })
  },
}

export const updateVisit: CommandHandler<VisitInput, VisitResult> = {
  id: 'logotherapy.visits.update',
  isUndoable: true,
  async prepare(raw, ctx) {
    const { parsed } = parseVisitUpdate(raw)
    const scope = ensureScope(ctx)
    const record = await loadVisit(ctx.container.resolve('em') as EntityManager, parsed.id, scope)
    if (!record) throw notFound('Visit not found')
    enforceCommandOptimisticLock({ resourceKind: ENTITY_ID, resourceId: record.id, current: record.updatedAt, expected: parsed.updatedAt, request: ctx.request })
    return { before: await snapshotVisit(ctx.container.resolve('em') as EntityManager, record.id, scope) }
  },
  async execute(raw, ctx) {
    const { parsed, custom } = parseVisitUpdate(raw)
    const scope = ensureScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    const record = await loadVisit(em, parsed.id, scope)
    if (!record) throw notFound('Visit not found')
    enforceCommandOptimisticLock({ resourceKind: ENTITY_ID, resourceId: record.id, current: record.updatedAt, expected: parsed.updatedAt, request: ctx.request })
    const next = { customerId: parsed.customerId ?? record.customerId, employeeId: parsed.employeeId ?? record.employeeId, resourceId: parsed.resourceId ?? record.resourceId, startAt: parsed.startAt ?? record.startAt, endAt: parsed.endAt ?? record.endAt }
    requireTherapyType(custom, false)
    await assertAvailable(em, { employeeId: next.employeeId, resourceId: next.resourceId, startAt: next.startAt, endAt: next.endAt, id: record.id }, scope)
    if (parsed.customerId !== undefined || parsed.employeeId !== undefined || parsed.resourceId !== undefined) Object.assign(record, { customerId: next.customerId, employeeId: next.employeeId, resourceId: next.resourceId, ...await ensureReferences(em, next, scope) })
    Object.assign(record, { ...(parsed.startAt !== undefined ? { startAt: parsed.startAt } : {}), ...(parsed.endAt !== undefined ? { endAt: parsed.endAt } : {}), ...(parsed.status !== undefined ? { status: parsed.status } : {}), ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}) })
    await withAtomicFlush(em, [() => { em.persist(record) }], { transaction: true, label: 'logotherapy.visit.update' })
    if (Object.keys(custom).length) await setCustomFieldsIfAny({ dataEngine, entityId: ENTITY_ID, recordId: record.id, ...scope, values: custom })
    await emitCrudSideEffects({ dataEngine, action: 'updated', entity: record, identifiers: identifiers(record, scope), events: visitCrudEvents, syncOrigin: ctx.syncOrigin })
    return resultFor(record)
  },
  async captureAfter(_input, result, ctx) { return snapshotVisit(ctx.container.resolve('em') as EntityManager, result.id, ensureScope(ctx)) },
  buildLog({ result, snapshots }) {
    const before = snapshots.before as VisitSnapshot | null | undefined
    const after = snapshots.after as VisitSnapshot | null | undefined
    return { actionLabel: 'Update therapy visit', resourceKind: ENTITY_ID, resourceId: result.id, tenantId: before?.tenantId ?? null, organizationId: before?.organizationId ?? null, snapshotBefore: before ?? null, snapshotAfter: after ?? null, payload: { undo: { before: before ?? undefined, after: after ?? undefined } satisfies UndoPayload } }
  },
  async undo({ logEntry, ctx }) {
    const payload = extractUndoPayload<UndoPayload>(logEntry)
    const snapshot = payload?.before ?? (logEntry.snapshotBefore as VisitSnapshot | null | undefined)
    if (snapshot) await restoreSnapshot(snapshot, ctx)
  },
}

export const deleteVisit: CommandHandler<VisitInput, VisitResult> = {
  id: 'logotherapy.visits.delete',
  isUndoable: true,
  async prepare(raw, ctx) {
    const id = requireId(raw, 'Visit id required')
    const scope = ensureScope(ctx)
    const record = await loadVisit(ctx.container.resolve('em') as EntityManager, id, scope)
    if (!record) throw notFound('Visit not found')
    enforceCommandOptimisticLock({ resourceKind: ENTITY_ID, resourceId: id, current: record.updatedAt, expected: raw.updatedAt as string | undefined, request: ctx.request })
    return { before: await snapshotVisit(ctx.container.resolve('em') as EntityManager, id, scope) }
  },
  async execute(raw, ctx) {
    const id = requireId(raw, 'Visit id required')
    const scope = ensureScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    const record = await loadVisit(em, id, scope)
    if (!record) throw notFound('Visit not found')
    enforceCommandOptimisticLock({ resourceKind: ENTITY_ID, resourceId: id, current: record.updatedAt, expected: raw.updatedAt as string | undefined, request: ctx.request })
    record.deletedAt = new Date()
    await withAtomicFlush(em, [() => { em.persist(record) }], { transaction: true, label: 'logotherapy.visit.delete' })
    await emitCrudSideEffects({ dataEngine, action: 'deleted', entity: record, identifiers: identifiers(record, scope), events: visitCrudEvents, syncOrigin: ctx.syncOrigin })
    return resultFor(record)
  },
  buildLog({ result, snapshots }) {
    const before = snapshots.before as VisitSnapshot | null | undefined
    return { actionLabel: 'Delete therapy visit', resourceKind: ENTITY_ID, resourceId: result.id, tenantId: before?.tenantId ?? null, organizationId: before?.organizationId ?? null, snapshotBefore: before ?? null, payload: { undo: { before: before ?? undefined } satisfies UndoPayload } }
  },
  async undo({ logEntry, ctx }) {
    const payload = extractUndoPayload<UndoPayload>(logEntry)
    const snapshot = payload?.before ?? (logEntry.snapshotBefore as VisitSnapshot | null | undefined)
    if (snapshot) await restoreSnapshot(snapshot, ctx)
  },
}

registerCommand(createVisit)
registerCommand(updateVisit)
registerCommand(deleteVisit)
