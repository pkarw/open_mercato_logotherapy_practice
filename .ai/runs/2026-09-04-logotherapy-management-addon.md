# Logotherapy management addon — Phase 1 implementation run

Goal: Complete the approved Phase 1 vertical slice so authorized staff can securely book, list, inspect, edit, cancel, and conflict-check scoped therapy visits with seeded rooms and a required therapy-type custom field.

Scope: Phase 1 only; AC-001–AC-004 and AC-006–AC-008. The implementation owns `src/modules/logotherapy/`, additive module registration, discovery output, and the app-owned visit schema. It integrates with installed Customers, Staff, Resources, and shared custom-field/encryption contracts through scalar IDs and scoped snapshots.

Non-goals: Phase 2 CRM calendar projection, external notifications, recurring appointments, portal booking, billing, clinical records, installed-package edits, generated-file edits, and migration application.

Source doc: `.ai/specs/2026-09-04-logotherapy-management-addon.md`

Risks: The existing scaffold contains guessed framework contracts and one baseline type error; replacing those approximations may require focused installed-source inspection. The visit schema and scoped conflict invariant require a reviewed migration probe, but the database must not be mutated without approval. User-facing pages require canonical CRUD primitives and full state/theme/accessibility coverage.

## Implementation Plan

### Phase 1: Visit foundation and booking vertical slice

- [ ] 1.1 Reconcile the existing scaffold against installed domain, encryption, custom-field, command, CRUD, and compatibility contracts; implement the scoped visit entity, validators, commands, events, and API.
- [ ] 1.2 Implement idempotent setup/ACL/registration and scoped customer, employee, and room option sources, including Room type plus Room 1/2/3 seeding.
- [ ] 1.3 Complete the visits list/create/detail/edit UI with `DataTable`, `CrudForm`, shared API helpers, translations, conflict handling, and required quality states.
- [ ] 1.4 Add self-contained regression/integration coverage for lifecycle, scope, conflicts, optimistic locking, setup idempotency, custom-field round trips, and therapy-type validation; run generation, schema probe, focused tests, typecheck, lint, and the configured gate.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Visit foundation and booking vertical slice

- [ ] 1.1 Reconcile the existing scaffold against installed domain, encryption, custom-field, command, CRUD, and compatibility contracts; implement the scoped visit entity, validators, commands, events, and API.
- [ ] 1.2 Implement idempotent setup/ACL/registration and scoped customer, employee, and room option sources, including Room type plus Room 1/2/3 seeding.
- [ ] 1.3 Complete the visits list/create/detail/edit UI with `DataTable`, `CrudForm`, shared API helpers, translations, conflict handling, and required quality states.
- [ ] 1.4 Add self-contained regression/integration coverage for lifecycle, scope, conflicts, optimistic locking, setup idempotency, custom-field round trips, and therapy-type validation; run generation, schema probe, focused tests, typecheck, lint, and the configured gate.
