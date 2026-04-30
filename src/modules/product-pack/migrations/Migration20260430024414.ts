import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260430024414 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pack_item" drop constraint if exists "pack_item_pack_id_variant_id_unique";`);
    this.addSql(`alter table if exists "product_pack" drop constraint if exists "product_pack_product_id_unique";`);
    this.addSql(`create table if not exists "product_pack" ("id" text not null, "product_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_pack_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_pack_product_id_unique" ON "product_pack" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_pack_deleted_at" ON "product_pack" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pack_item" ("id" text not null, "pack_id" text not null, "variant_id" text not null, "quantity" integer not null default 1, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pack_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pack_item_pack_id" ON "pack_item" ("pack_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pack_item_variant_id" ON "pack_item" ("variant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pack_item_deleted_at" ON "pack_item" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pack_item_pack_id_variant_id_unique" ON "pack_item" ("pack_id", "variant_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "pack_item" add constraint "pack_item_pack_id_foreign" foreign key ("pack_id") references "product_pack" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "pack_item" drop constraint if exists "pack_item_pack_id_foreign";`);

    this.addSql(`drop table if exists "product_pack" cascade;`);

    this.addSql(`drop table if exists "pack_item" cascade;`);
  }

}
