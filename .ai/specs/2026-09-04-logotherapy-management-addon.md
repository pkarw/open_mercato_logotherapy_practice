# Logotherapy Management Addon

**Date**: 2026-09-04
**Status**: Draft

## TLDR

Build an app-owned `logotherapy` addon for managing therapy visits. Staff can select an existing CRM customer, select a therapy type (`Logotherapy` or `Sensory Integration`), book a time, assign an existing employee and an existing room resource, and see the booking in the CRM calendar. The addon uses Customers for people and CRM context, Staff for employees, Resources for rooms, Planner for availability rules, custom fields for clinic-specific metadata, and module setup seeding for `Room 1`, `Room 2`, and `Room 3`.

## Problem Statement

A logotherapy practice needs one operational workflow for turning a CRM customer into a scheduled visit. Today there is no addon-owned visit record that combines the customer, appointment time, employee, and room. Staff would otherwise maintain disconnected notes or manually coordinate rooms, creating double-booking and reporting risk.

## Overview and Success Measures

- **Primary outcome:** A permitted staff member can create, update, cancel, and find a logotherapy visit with a customer, employee, and room, with conflicting bookings rejected before commit.
- **Leading indicators:** 100% of created visits have a valid customer, employee, room, start/end, and status; zero overlapping active bookings for the same employee or room.
- **Baseline:** unknown — measure current manual booking volume and conflicts during rollout.
- **Market / product reference:** A lightweight clinic scheduling workflow; adopt customer-centric scheduling and resource conflict prevention, defer billing, clinical records, and patient-portal features.

## Goals

- **REQ-001** — Staff can manage a scoped logotherapy visit linked to an existing CRM customer.
- **REQ-002** — Each visit can be assigned to an existing Staff employee and Resources room.
- **REQ-003** — The addon prevents overlapping active visits for the same employee or room.
- **REQ-004** — Visits are represented in the CRM calendar through the supported calendar integration seam.
- **REQ-005** — Visit records support localized custom fields without changing installed module entities.
- **REQ-006** — Tenant initialization seeds exactly three idempotent example rooms: `Room 1`, `Room 2`, and `Room 3`.
- **REQ-007** — Authorization, tenant isolation, optimistic locking, auditability, and recoverable validation/conflict errors are enforced.
- **REQ-008** — Each booking has a required selectable therapy type custom field with initial options `Logotherapy` and `Sensory Integration`.

## Non-goals

- Billing, invoices, payments, insurance claims, or product/catalog behavior.
- Clinical diagnosis, psychotherapy notes, medical records, or regulated-health-data workflows beyond the minimum booking metadata.
- Replacing Customers, Staff, Resources, Planner, or the CRM calendar.
- Customer self-service portal booking, reminders, external calendar synchronization, recurring appointments, waitlists, or online payments in the first release.
- Deleting or modifying installed package code, generated files, or shipped migrations.

## Proposed Solution

Create `src/modules/logotherapy/` as a standalone app-owned module. It owns the visit lifecycle and references installed records by scoped scalar IDs plus display snapshots where needed. Customer, employee, and room selectors use the owning module's scoped option sources and render display names; raw IDs exist only in API payloads.

The primary staff flow is a `DataTable` of visits with filters for date range, status, employee, room, and customer, plus a `CrudForm` for create/edit. A visit detail view links to the CRM customer and shows its calendar placement. The CRM `/backend/calendar` remains the calendar source of truth for calendar presentation; the addon contributes visits using the installed calendar extension/event contract identified during implementation discovery.

The module setup creates or reuses Resources resource type `Room` and idempotently seeds `Room 1`, `Room 2`, and `Room 3` within the current tenant and organization. It must not create duplicate resources on rerun.

### Design Decisions and Alternatives

| Decision | Rationale | Alternative considered | Why rejected / deferred |
|---|---|---|---|
| App-owned `logotherapy_visit` entity | Visit status, assignment, conflict rules, and lifecycle are addon invariants. | Add fields to `customers:customer_activity` | Would couple booking invariants to an installed CRM entity and cannot own room conflict state cleanly. |
| Scalar IDs to Customer, Staff, and Resource records | Preserves module boundaries and upgradeability. | Cross-module ORM relations | Prohibited; use IDs/snapshots and owning-module option sources. |
| Existing Resources records represent rooms | Rooms are resources, not a second logotherapy entity. | `logotherapy_room` table | Duplicates resource management and creates reconciliation problems. |
| One-time visits in the first release | Keeps scheduling semantics clear and conflict checks deterministic. | Recurring series | Deferred until recurrence, exception, and cancellation rules are specified. |
| Calendar integration through the supported installed seam | Keeps CRM calendar behavior and navigation intact. | A second calendar UI or direct package edits | Duplicates UX and violates package ownership; exact seam must be confirmed before implementation. |

## Domain Vocabulary and Business Rules

| Term / invariant | Precise meaning or rule | Source of truth | Failure behavior |
|---|---|---|---|
| Visit | One scheduled logotherapy session for one CRM customer. | `logotherapy:logotherapy_visit` | Reject incomplete or cross-scope references. |
| Active visit | Status `scheduled` or `confirmed`; `cancelled` and `completed` do not reserve capacity. | Visit status enum | Reject unsupported status transitions. |
| Time interval | Half-open `[start_at, end_at)` in the tenant timezone; `end_at` must be after `start_at`. | Visit timestamps + tenant timezone | Return validation error. |
| Employee assignment | One Staff team member responsible for the visit. | `staff:staff_team_member` scalar ID | Reject missing, inactive, or out-of-scope employee. |
| Room assignment | One Resources resource representing a room. | `resources:resources_resource` scalar ID | Reject missing, inactive, or out-of-scope room. |
| Conflict | Two active visits overlap when `existing.start_at < new.end_at` and `existing.end_at > new.start_at`, for the same employee or room. | Transactional visit query | Return 409 with conflicting display names/times; do not commit. |
| Customer | Existing CRM person/company record eligible for a visit. | Customers module | Reject missing or out-of-scope customer; do not duplicate CRM data. |
| Custom field | Tenant-defined addon field stored through the platform custom-field contract. | `logotherapy` visit custom fields | Validate definition and value; preserve explicit null clearing. |
| Therapy type | Required visit custom field `therapy_type`; initial select options are `logotherapy` (displayed as `Logotherapy`) and `sensory_integration` (displayed as `Sensory Integration`). | `logotherapy` custom-field definition and visit value | Reject missing/unknown values; allow future tenant-admin options only through the custom-field configuration contract. |

## Users, Permissions, and Scope

| Actor | Allowed outcomes | Scope rule | Required feature IDs |
|---|---|---|---|
| Administrator | Manage visits, assign staff/resources, configure custom fields, seed defaults | Current tenant and organization | `logotherapy.view`, `logotherapy.manage`, `logotherapy.configure` |
| Scheduler / manager | View and manage visits and assignments | Current tenant and organization | `logotherapy.view`, `logotherapy.manage` |
| Employee | View assigned visits; update permitted status/notes only if policy allows | Current tenant and organization; assigned employee restriction | `logotherapy.view`, `logotherapy.self_manage` |

Every API derives `tenantId` and `organizationId` from trusted authenticated server context and fails closed when missing. No request body, query parameter, or browser state may establish scope. System scope is not used. Cross-tenant and cross-organization references must return indistinguishable not-found/forbidden behavior as appropriate.

## Reuse and Ownership Map

| Capability | Reuse / extend / app-own | Existing module or new module | Integration seam | Why |
|---|---|---|---|---|
| Customer identity and CRM record | Reuse | `customers` | Scoped customer option source; scalar customer ID/snapshot | Customers remains source of truth. |
| CRM calendar display | Extend | `customers` | Supported calendar event/extension seam, to be confirmed | Avoid a second calendar and package edits. |
| Employee directory | Reuse | `staff` | Scoped team-member option source; scalar staff ID/snapshot | Staff owns employee lifecycle. |
| Room inventory | Reuse | `resources` | Resource type/resource commands and setup contract | Resources owns room records and availability metadata. |
| Availability rules | Reuse | `planner` | Planner availability APIs/commands where applicable | Do not duplicate employee/resource schedules. |
| Visit lifecycle and conflict invariant | App-own | `logotherapy` | Commands, API, events, custom fields | Only the addon knows visit-specific booking rules. |
| Custom fields | Reuse | Shared/entities contract | `defineFields`/custom-field persistence and CRUD round trip | Tenant-specific metadata without schema churn. |

## Architecture and Data Flow

```text
Staff user -> logotherapy DataTable/CrudForm -> guarded API/command -> logotherapy_visit
                                                   -> conflict check (employee + room)
                                                   -> commit
                                                   -> visit event -> calendar adapter/index/audit
Customer / Staff / Resources option sources --------------------^ 
Tenant setup -> Resources room type/resource setup -> Room 1/2/3
```

- **Module boundaries:** `logotherapy` owns visits and booking invariants; Customers, Staff, Resources, and Planner remain authoritative for their records and rules.
- **Extension points:** Use the CRM calendar's installed extension or event seam after exact installed facts are confirmed. Use app module discovery for pages, APIs, setup, commands, events, and custom fields.
- **Alternatives considered:** A single CRM activity with arbitrary metadata is smaller but cannot safely own assignment/resource uniqueness and optimistic locking; it is rejected.
- **Compatibility:** No installed API, event ID, entity, route, or database table is removed or renamed. Existing CRM calendar and records continue to work when the addon has no visits.

## User Journeys

### Journey J-001 — Book a visit

1. A scheduler opens `/backend/logotherapy/visits` and selects **Book visit**.
2. The form selects a scoped CRM customer, required therapy type, employee, room, start/end, status, and optional additional custom fields.
3. The server validates all references, derives scope, checks Planner availability when supported, checks employee/room overlap transactionally, and commits the visit.
4. The UI returns to the visit detail/list, shows the calendar placement, and emits an auditable created event.
5. Validation errors preserve input; a 409 identifies the conflict without leaking unrelated tenant data; the user can adjust time, employee, or room and retry.

### Journey J-002 — Reschedule or cancel

1. A permitted user opens an existing visit with its `updatedAt` version.
2. Updating time, employee, or room repeats validation and conflict checks; cancellation releases the reservations.
3. A stale version returns 409 and surfaces the shared conflict recovery UI; no changes are silently overwritten.

## UI and Interaction Contracts

| Surface / route | Purpose and primary actions | Data source / mutations | Closest installed reference | Canonical shell / components | Required states | Requirement IDs |
|---|---|---|---|---|---|---|
| `/backend/logotherapy/visits` | Filter, inspect, and start booking visits | `GET /api/logotherapy/visits`, link to create/edit | Customers `/backend/calendar`; Customers people list | `Page`, `PageBody`, `DataTable`, shared filters/actions | loading, empty, error, permission denied, responsive, keyboard | REQ-001–REQ-004 |
| `/backend/logotherapy/visits/create` | Create a visit | `CrudForm` + `POST /api/logotherapy/visits` | Customers people create | `Page`, `CrudForm`, scoped selects, required therapy-type select, `FormFooter` | validation, server error, conflict, success, keyboard | REQ-001–REQ-003, REQ-005, REQ-008 |
| `/backend/logotherapy/visits/[id]` | View/edit/cancel a visit | `GET/PATCH/DELETE /api/logotherapy/visits/:id` | Customers customer detail | `Page`, detail sections, `CrudForm`, conflict banner | loading, not-found, error, conflict, success, dark/light | REQ-001–REQ-004, REQ-007 |
| `/backend/logotherapy/config/custom-fields` | Configure addon custom fields | Shared custom-field configuration surface or addon page, pending installed contract | Existing custom-field manager | Platform-native settings shell | loading, empty, validation, permission denied, responsive | REQ-005 |

### UI architecture

| Role | Navigation groups in order | Dashboard / injected widgets | Login-to-primary-task flow |
|---|---|---|---|
| Scheduler / manager | Logotherapy → Visits; existing Customers → Calendar remains available | Optional future calendar summary; none required for MVP | Login → Visits → Book visit, at most 2 actions after landing |
| Employee | Logotherapy → My visits (filtered) | None required | Login → My visits → update allowed status |

Every reference field is a searchable scoped selection control showing display names, never an ID. Tables show customer, employee, and room names. Dialogs support Cmd/Ctrl+Enter and Escape. All text, statuses, validation, empty/error messaging, and navigation labels use translation keys. The implementation must use shared `apiCall` helpers, `DataTable`, `CrudForm`, semantic tokens, accessible labels, focus management, narrow-width behavior, reduced motion, and light/dark themes.

```text
┌────────────────────────────────────────────────────────────┐
│ Visits                                      [Book visit]   │
│ Date range | Status | Customer | Employee | Room | Search  │
├────────────────────────────────────────────────────────────┤
│ Date/time | Customer | Employee | Room | Status | Actions   │
├────────────────────────────────────────────────────────────┤
│ Pagination / empty guidance / retry                        │
└────────────────────────────────────────────────────────────┘
```

## Data Models

### `LogotherapyVisit`

| Field | Type / nullability | Scope / index | Sensitive / encrypted | Lifecycle and validation |
|---|---|---|---|---|
| `id` | UUID, required | primary key | no | immutable |
| `tenant_id`, `organization_id` | UUID, required | composite scope indexes | no | trusted context only |
| `customer_id` | UUID, required | scope + customer index | no | scalar ID to Customers record |
| `customer_snapshot` | JSON, required | not indexed | no | display snapshot refreshed on write; not source of truth |
| `employee_id` | UUID, required | scope + employee/time index | no | scalar ID to Staff member |
| `employee_snapshot` | JSON, required | not indexed | no | display snapshot for stable tables/audit |
| `resource_id` | UUID, required | scope + resource/time index | no | scalar ID to Resources resource; must be a room |
| `resource_snapshot` | JSON, required | not indexed | no | display snapshot for stable tables/audit |
| `start_at`, `end_at` | timezone-aware timestamps, required | scope/time indexes | no | end after start; tenant timezone presentation |
| `status` | enum `scheduled|confirmed|completed|cancelled`, required | scope/status index | no | explicit transition policy; cancelled frees capacity |
| `notes` | text, nullable | none | potentially sensitive; encrypt if policy classifies it | Keep MVP non-clinical; redact logs |
| `custom_fields` | platform custom-field payload, nullable | custom-field contract | per field definition | Validate and round-trip null clearing |
| `created_at`, `updated_at` | timestamps, required | standard | no | `updated_at` is optimistic-lock version |
| `deleted_at` | timestamp, nullable | scope/soft-delete index | no | soft-delete only if platform CRUD policy requires it |

Use `src/modules/logotherapy/data/entities.ts`; use scalar IDs rather than cross-module ORM relations. Define the required `therapy_type` select field through the addon custom-field contract, with stable machine values `logotherapy` and `sensory_integration` and localized labels. The employee and room conflict query must be scoped and protected by the database/transaction strategy selected during implementation. If PostgreSQL exclusion constraints are compatible with project migration policy, evaluate them; otherwise use transactional locking/command guards and a regression test. No migration is applied during specification work.

## API, Command, and Error Contracts

| Method / command | Path / ID | Auth and feature gate | Input | Success response / event | Errors and concurrency | Requirement IDs |
|---|---|---|---|---|---|---|
| `GET` | `/api/logotherapy/visits` | auth + `logotherapy.view` | scoped filters, pagination, sort | paged visits with display snapshots | 400/401/403; never unscoped | REQ-001, REQ-002 |
| `GET` | `/api/logotherapy/visits/:id` | auth + `logotherapy.view` | route ID | visit detail | 403/404; no cross-scope leak | REQ-001 |
| `POST` | `/api/logotherapy/visits` | auth + `logotherapy.manage` | customer, required `therapy_type`, employee, room, interval, status, custom fields | 201 + `logotherapy.visit.created` | 400/403/409 conflict; invalid therapy type is 400 | REQ-001–REQ-005, REQ-008 |
| `PATCH` | `/api/logotherapy/visits/:id` | auth + `logotherapy.manage` | changed fields, including `therapy_type`, + required `updatedAt` | updated visit + `logotherapy.visit.updated` | 400/403/404/409; invalid therapy type is 400 | REQ-001–REQ-005, REQ-007, REQ-008 |
| `POST` | `/api/logotherapy/visits/:id/cancel` | auth + `logotherapy.manage` | `updatedAt`, cancellation reason | cancelled visit + event | 403/404/409 | REQ-003, REQ-007 |
| `GET` | `/api/logotherapy/options/customers` | auth + `logotherapy.view` | scoped search | display-name options | 400/403; scoped | REQ-001 |
| `GET` | `/api/logotherapy/options/employees` | auth + `logotherapy.view` | scoped search | display-name options | 400/403; scoped | REQ-002 |
| `GET` | `/api/logotherapy/options/rooms` | auth + `logotherapy.view` | scoped search | active room options | 400/403; scoped | REQ-002, REQ-006 |

CRUD list/detail/create/update uses `makeCrudRoute` where compatible; cancellation and any conflict-sensitive action use a guarded command route. Every route declares per-method `metadata` and `openApi`. Commands use atomic writes, shared optimistic-lock helpers, idempotency for retries where applicable, and post-commit effects only. The calendar adapter must be optional/fail-soft for presentation indexing while the visit commit remains authoritative.

## Events, Jobs, Notifications, and Cross-Module Flows

| Trigger | Producer | Consumer | Side effect | Retry / idempotency / audit behavior |
|---|---|---|---|---|
| `logotherapy.visit.created` | logotherapy command | calendar adapter, audit/index subscribers | Add/update CRM calendar representation | Post-commit, idempotent by visit ID; log failure without rolling back visit |
| `logotherapy.visit.updated` | logotherapy command | calendar adapter, audit/index subscribers | Move/update calendar entry | Idempotent upsert; stale update rejected before event |
| `logotherapy.visit.cancelled` | cancel command | calendar adapter, audit subscriber | Mark/remove calendar entry | Idempotent; cancellation remains visible in audit |
| Tenant setup | logotherapy setup | resources setup/commands | Ensure room type and three rooms | Idempotent by scoped stable seed keys/names; report failures |

No background job is required for MVP. Reminders and external notifications are deferred. Calendar integration must not make a committed visit disappear if the downstream presentation update fails; expose an operationally detectable retry/reconciliation path in implementation if the installed seam is asynchronous.

## Security, Privacy, and Compliance

- **Authorization:** Use declarative `logotherapy.*` feature gates and record scope; never role-name checks.
- **Tenant isolation:** Derive scope server-side, filter every read/write, validate all referenced records in the same scope, and fail closed on missing scope.
- **Sensitive data:** Keep MVP notes non-clinical; use the platform encryption map if notes become sensitive. Never place notes or secrets in logs, events, snapshots, URLs, or error messages.
- **Abuse and failure modes:** Prevent ID enumeration, replayed duplicate submits, cross-tenant option probing, double-booking, stale edits, and unauthorized cancellation. Return safe 403/404/409 responses.

## Integration Coverage

| Test ID | Level | Setup / fixture | Actions | Assertions | Requirement IDs |
|---|---|---|---|---|---|
| TEST-001 | integration | Tenant/org, CRM customer, Staff employee, three seeded room resources | POST a valid visit; GET list/detail | Persisted links/snapshots, 201 response, created event, scoped result | REQ-001, REQ-002, REQ-006 |
| TEST-002 | integration | Same employee and room with an existing active visit | POST overlapping employee and room bookings | 409, no second record, no calendar side effect | REQ-003 |
| TEST-003 | security | Two tenants/orgs and users with varied feature grants | Cross-scope GET/POST/PATCH and forbidden role actions | Fail closed; no data leak or mutation | REQ-007 |
| TEST-004 | integration | Existing visit and changed `updatedAt` | PATCH with stale version; then valid cancel | First 409; second succeeds and releases capacity/event is emitted | REQ-003, REQ-007 |
| TEST-005 | integration | Tenant setup run twice | Run setup/seed path twice | Exactly Room 1/2/3 per scope; no duplicates; room type reused | REQ-006 |
| TEST-006 | UI/integration | Authorized user, empty and populated fixtures | Exercise list/create/edit/cancel, loading/error/conflict, keyboard, narrow viewport, light/dark | Visible names, preserved errors, accessible focus/status, conflict recovery, responsive themed UI | REQ-001–REQ-007 |
| TEST-007 | calendar integration | Valid created/updated/cancelled visits | Exercise supported CRM calendar seam | Calendar shows, moves, and cancels the visit idempotently without changing visit authority | REQ-004 |
| TEST-008 | integration | Visit custom-field definition and valid/invalid booking payloads | Create and edit with both therapy options, then omit/use an unknown option | Both valid values persist and render localized labels; missing/unknown values return 400 | REQ-005, REQ-008 |

## Implementation Phases

### Phase 1 — Visit foundation and booking vertical slice

- **Depends on:** none
- **Outcome:** Staff can securely create, list, view, edit, cancel, and conflict-check visits linked to existing customer, employee, and room records.
- **Why this order / value delivered:** Establishes the core invariant and usable booking workflow before calendar projection.
- **Deliverables:** `src/modules/logotherapy/data/entities.ts`, validators, commands, setup, ACL, scoped option routes, CRUD/action APIs, events, list/detail/create/edit UI, required `therapy_type` select custom field with Logotherapy and Sensory Integration options, custom-field round trip, Room type and Room 1/2/3 seed.
- **Independent slices / estimated commits:** domain/setup/API; UI surfaces; tests may proceed independently after contracts are fixed.
- **Requirements closed:** REQ-001, REQ-002, REQ-003, REQ-005, REQ-006, REQ-007, REQ-008
- **Tests:** TEST-001 through TEST-006, TEST-008
- **Validation:** `yarn generate`, `yarn db:generate` with reviewed scoped SQL/snapshot only, focused unit/integration tests, `yarn typecheck`, `yarn lint`.
- **Exit gate:** Authorized users complete the booking flow; overlapping employee/room bookings return 409; second setup run creates no duplicates; forbidden/cross-scope operations fail closed; UI states work in light/dark and narrow width.

### Phase 2 — CRM calendar integration

- **Depends on:** Phase 1 exit gate and confirmation of the installed Customers calendar seam.
- **Outcome:** Every committed visit has an idempotent CRM calendar representation that remains consistent after rescheduling and cancellation.
- **Why this order / value delivered:** Calendar presentation depends on the stable visit lifecycle and events.
- **Deliverables:** Calendar adapter/extension, event subscriber or supported integration, reconciliation/error visibility if asynchronous, calendar integration tests.
- **Independent slices / estimated commits:** seam adapter and event handling; TEST-007 verification.
- **Requirements closed:** REQ-004
- **Tests:** TEST-007
- **Validation:** `yarn generate`, focused calendar integration test, `yarn typecheck`, `yarn lint`, affected UI QA.
- **Exit gate:** Create, update, and cancel are reflected once in `/backend/calendar`; a failed projection does not roll back a committed visit and is observable/retryable.

## Requirement Traceability

| Requirement | Journey / surface | Data/API/event contracts | Phase | Tests | Acceptance criterion |
|---|---|---|---|---|---|
| REQ-001 | J-001/J-002, visits surfaces | `LogotherapyVisit`, visit CRUD | 1 | TEST-001, TEST-006 | A permitted scheduler can complete a customer-linked visit lifecycle. |
| REQ-002 | J-001, form/table | employee/resource scalar references and option APIs | 1 | TEST-001, TEST-006 | Employee and room display names are selected and persisted. |
| REQ-003 | J-001/J-002 | transactional overlap invariant, 409 | 1 | TEST-002, TEST-004 | No two active visits overlap for one employee or room. |
| REQ-004 | J-001/J-002, CRM calendar | visit events and calendar adapter | 2 | TEST-007 | Calendar create/update/cancel projection is idempotent. |
| REQ-005 | create/edit/config | custom-field contract | 1 | TEST-006 | Custom fields save, reload, clear, validate, and localize. |
| REQ-006 | tenant setup | Resources type/resource setup | 1 | TEST-001, TEST-005 | Each scope has exactly Room 1, Room 2, Room 3 after repeated setup. |
| REQ-007 | all surfaces | ACL, scope, optimistic locking, audit | 1 | TEST-003, TEST-004, TEST-006 | Unauthorized, cross-scope, stale, and unsafe requests fail without mutation/leakage. |
| REQ-008 | create/edit form | required `therapy_type` custom field and select options | 1 | TEST-006, TEST-008 | Every booking stores one valid therapy type and the UI displays Logotherapy or Sensory Integration. |

## Rollout, Migration, and Rollback

Generate and review the app-owned migration and snapshot in Phase 1; ask for approval before applying it. Setup seeds the room type/resources idempotently and does not delete existing resources. Rollout enables the module after migration and setup are verified. Rollback disables the module registration and calendar adapter; retain visit data for a later re-enable. Do not remove installed Customers, Staff, Resources, or Planner data. If the calendar projection is incompatible, disable only the adapter while preserving booking operations and expose reconciliation status.

## Risks and Tradeoffs

| Risk / tradeoff | Impact | Mitigation / detection | Residual risk |
|---|---|---|---|
| Race between two bookings | Double-booked employee/room | Transactional conflict check/locking, TEST-002, metrics for 409s | Database-specific locking behavior must be proven. |
| Calendar seam differs from assumptions | Visits do not appear in CRM calendar | Confirm exact installed contract before Phase 2; adapter contract test | Calendar projection may lag a commit. |
| Customer/employee/resource deactivated after booking | Historical visit becomes hard to edit | Keep snapshots, validate active status for new assignments, preserve historical display | Reassignment policy may need refinement. |
| Notes contain clinical data | Privacy/compliance exposure | Explicitly non-clinical MVP, encryption/redaction policy, audit review | Users may still enter sensitive free text. |
| Seed rerun duplicates rooms | Clutter and ambiguous selectors | Stable scoped lookup and TEST-005 | Existing manually named rooms require operator review. |
| Disabled modules are accidentally re-enabled | Unwanted navigation/contracts return | Registration assertion and deployment review | Environment-specific official module entries require checking. |

## Acceptance Criteria

- [ ] **AC-001** — A scheduler with `logotherapy.manage` can select a CRM customer, Staff employee, and Resources room and book a visit that reloads with display names and timestamps.
- [ ] **AC-002** — Overlapping active visits for the same employee or room are rejected with 409 and leave no partial record or calendar side effect.
- [ ] **AC-003** — Repeated tenant setup results in exactly `Room 1`, `Room 2`, and `Room 3` per scope without duplicates.
- [ ] **AC-004** — Visit custom fields round-trip through create, edit, reload, and explicit clear.
- [ ] **AC-005** — CRM calendar reflects visit create, reschedule, and cancellation through the supported installed seam.
- [ ] **AC-006** — Cross-scope, unauthorized, and stale-version requests fail closed; UI surfaces conflict and retry guidance.
- [ ] **AC-007** — All listed UI surfaces use canonical primitives and have loading, empty, error, conflict, keyboard, accessibility, responsive, light-mode, and dark-mode coverage.
- [ ] **AC-008** — Booking creation and editing require a therapy type and expose localized selectable options for Logotherapy and Sensory Integration; invalid or missing values are rejected.
- [ ] Every affected API and UI path has self-contained integration coverage and the configured validation gate passes.

## Final Compliance Report

| Check | Status | Evidence / resolution |
|---|---|---|
| Applicable `AGENTS.md` files and routed guides/skills reviewed | pass with limitation | Root rules, `spec-delivery`, backend UI guide, and Customers/Planner/Resources/Staff facts reviewed; `om-spec-writing` skill is unavailable in this workspace. |
| Data models, APIs, events, UI, and tests are internally consistent | pass | Visit ownership and cross-module scalar references are defined; calendar seam remains a Phase 2 gate. |
| Every workflow completes end to end without a catch-all integration phase | pass | Two dependency-ordered vertical phases with explicit exit gates. |
| Platform-native reuse and extension points were chosen before custom code | pass | Customers, Staff, Resources, Planner, custom fields, and CRM calendar are mapped. |
| UI contracts identify references, canonical components, and theme/state coverage | pass | Four surfaces, selectors, states, and canonical primitives are listed. |
| Every phase has dependencies, bounded slices, tests, value, and an observable exit gate | pass | Phase 1 and Phase 2 each have deliverables, tests, validation, and gates. |

Verdict: `Blocked — confirm the installed Customers calendar integration seam and product policy for employee self-editing and visit notes before setting Ready for implementation.`

## Open Questions

Blocking questions must be resolved before setting `Status: Ready for implementation`.

| ID | Question | Owner | Blocking? | Resolution / decision date |
|---|---|---|---|---|
| Q-001 | Which installed Customers calendar event/extension contract should the addon use for visit projection? | Engineering | yes | Pending framework contract inspection |
| Q-002 | May employees edit only status, or also reschedule/modify assigned room and notes? | Product | yes | Pending product decision |
| Q-003 | Should visit notes be treated as potentially sensitive and encrypted from the first release? | Product / compliance | yes | Pending policy decision |

## Changelog

| Date | Change |
|---|---|
| 2026-09-04 | Initial draft |
| 2026-09-04 | Added required selectable therapy type custom field with Logotherapy and Sensory Integration options |
