import { Migration } from '@mikro-orm/migrations';

export class Migration20260904140213_logotherapy extends Migration {

  override name = 'Migration20260904140213';

  override up(): void | Promise<void> {
    this.addSql(`create table "logotherapy_visits" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "customer_id" uuid not null, "customer_snapshot" jsonb not null, "employee_id" uuid not null, "employee_snapshot" jsonb not null, "resource_id" uuid not null, "resource_snapshot" jsonb not null, "start_at" timestamptz not null, "end_at" timestamptz not null, "status" text not null default 'scheduled', "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "logotherapy_visits_resource_time_idx" on "logotherapy_visits" ("tenant_id", "organization_id", "resource_id", "start_at", "end_at");`);
    this.addSql(`create index "logotherapy_visits_employee_time_idx" on "logotherapy_visits" ("tenant_id", "organization_id", "employee_id", "start_at", "end_at");`);
    this.addSql(`create index "logotherapy_visits_scope_time_idx" on "logotherapy_visits" ("tenant_id", "organization_id", "start_at", "end_at");`);
  }

}
