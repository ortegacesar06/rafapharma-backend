import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260426223422 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "order_routing" drop constraint if exists "order_routing_order_id_unique";`);
    this.addSql(`create table if not exists "order_routing" ("id" text not null, "order_id" text not null, "mode" text check ("mode" in ('unified', 'optimal')) not null, "status" text check ("status" in ('routed', 'requires_manual_routing')) not null default 'routed', "total_surcharge_amount" numeric not null default 0, "raw_total_surcharge_amount" jsonb not null default '{"value":"0","precision":20}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_routing_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_order_routing_order_id_unique" ON "order_routing" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_routing_deleted_at" ON "order_routing" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "order_routing_shipment" ("id" text not null, "routing_id" text not null, "stock_location_id" text not null, "surcharge_amount" numeric not null default 0, "items" jsonb not null, "raw_surcharge_amount" jsonb not null default '{"value":"0","precision":20}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_routing_shipment_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_routing_shipment_routing_id" ON "order_routing_shipment" ("routing_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_routing_shipment_stock_location_id" ON "order_routing_shipment" ("stock_location_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_routing_shipment_deleted_at" ON "order_routing_shipment" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "order_routing_shipment" add constraint "order_routing_shipment_routing_id_foreign" foreign key ("routing_id") references "order_routing" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "order_routing_shipment" drop constraint if exists "order_routing_shipment_routing_id_foreign";`);

    this.addSql(`drop table if exists "order_routing" cascade;`);

    this.addSql(`drop table if exists "order_routing_shipment" cascade;`);
  }

}
