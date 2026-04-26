import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260426174208 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "canton" drop constraint if exists "canton_code_unique";`);
    this.addSql(`alter table if exists "province" drop constraint if exists "province_code_unique";`);
    this.addSql(`create table if not exists "province" ("id" text not null, "code" text not null, "name" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "province_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_province_code_unique" ON "province" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_province_deleted_at" ON "province" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "canton" ("id" text not null, "code" text not null, "name" text not null, "province_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "canton_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_canton_code_unique" ON "canton" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_canton_province_id" ON "canton" ("province_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_canton_deleted_at" ON "canton" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "canton" add constraint "canton_province_id_foreign" foreign key ("province_id") references "province" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "canton" drop constraint if exists "canton_province_id_foreign";`);

    this.addSql(`drop table if exists "province" cascade;`);

    this.addSql(`drop table if exists "canton" cascade;`);
  }

}
