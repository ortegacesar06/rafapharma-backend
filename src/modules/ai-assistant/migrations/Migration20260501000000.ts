import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260501000000 extends Migration {
  override async up(): Promise<void> {
    // pgvector — soporta búsqueda por similitud para RAG.
    this.addSql(`create extension if not exists "vector";`)

    this.addSql(
      `create table if not exists "conversation" ("id" text not null, "customer_id" text null, "started_at" timestamptz not null default now(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "conversation_pkey" primary key ("id"));`
    )
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_conversation_customer_id" ON "conversation" ("customer_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_conversation_deleted_at" ON "conversation" ("deleted_at") WHERE deleted_at IS NULL;`)

    this.addSql(
      `create table if not exists "conversation_message" ("id" text not null, "conversation_id" text not null, "role" text not null, "content" text not null, "input_tokens" integer null, "output_tokens" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "conversation_message_pkey" primary key ("id"));`
    )
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_conversation_message_conversation_id" ON "conversation_message" ("conversation_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_conversation_message_deleted_at" ON "conversation_message" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(
      `alter table if exists "conversation_message" add constraint "conversation_message_conversation_id_foreign" foreign key ("conversation_id") references "conversation" ("id") on update cascade;`
    )

    this.addSql(`alter table if exists "product_embedding" drop constraint if exists "product_embedding_product_id_unique";`)
    this.addSql(
      `create table if not exists "product_embedding" ("id" text not null, "product_id" text not null, "embedding_model" text not null, "source_text" text not null, "embedding" vector(512) null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_embedding_pkey" primary key ("id"));`
    )
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_embedding_product_id_unique" ON "product_embedding" ("product_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_embedding_deleted_at" ON "product_embedding" ("deleted_at") WHERE deleted_at IS NULL;`)
    // ivfflat para cosine similarity. Lists=100 OK hasta ~10k filas; reajustar si crece.
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_embedding_vector_cos" ON "product_embedding" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "conversation_message" cascade;`)
    this.addSql(`drop table if exists "conversation" cascade;`)
    this.addSql(`drop table if exists "product_embedding" cascade;`)
  }
}
