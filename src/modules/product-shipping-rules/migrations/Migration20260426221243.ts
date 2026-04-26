import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260426221243 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "product_shipping_rule" drop constraint if exists "product_shipping_rule_product_id_unique";`);
    this.addSql(`create table if not exists "product_shipping_rule" ("id" text not null, "product_id" text not null, "requires_unified_shipment" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_shipping_rule_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_shipping_rule_product_id_unique" ON "product_shipping_rule" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_shipping_rule_deleted_at" ON "product_shipping_rule" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_shipping_rule" cascade;`);
  }

}
