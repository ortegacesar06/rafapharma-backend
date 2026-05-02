import { MedusaService } from "@medusajs/framework/utils"
import Conversation from "./models/conversation"
import Message from "./models/message"
import ProductEmbedding from "./models/product-embedding"

type RawManager = {
  execute: (sql: string, params?: unknown[]) => Promise<any>
}

export type SimilarProduct = {
  product_id: string
  source_text: string
  distance: number
}

class AiAssistantModuleService extends MedusaService({
  Conversation,
  Message,
  ProductEmbedding,
}) {
  /**
   * Upsert del embedding de un producto. Se persiste vía SQL raw porque
   * la columna `embedding vector(N)` no existe en el modelo.
   */
  async upsertProductEmbedding(args: {
    product_id: string
    embedding: number[]
    embedding_model: string
    source_text: string
  }): Promise<void> {
    const { product_id, embedding, embedding_model, source_text } = args
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("upsertProductEmbedding: embedding must be a non-empty array")
    }
    const manager = this.getRawManager()
    const vec = `[${embedding.join(",")}]`
    await manager.execute(
      `INSERT INTO product_embedding (id, product_id, embedding_model, source_text, embedding, created_at, updated_at)
       VALUES ('pemb_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24), ?, ?, ?, ?::vector, now(), now())
       ON CONFLICT (product_id) WHERE deleted_at IS NULL
       DO UPDATE SET embedding = EXCLUDED.embedding,
                     embedding_model = EXCLUDED.embedding_model,
                     source_text = EXCLUDED.source_text,
                     updated_at = now()`,
      [product_id, embedding_model, source_text, vec]
    )
  }

  async deleteProductEmbedding(productId: string): Promise<void> {
    const manager = this.getRawManager()
    await manager.execute(
      `UPDATE product_embedding SET deleted_at = now() WHERE product_id = ? AND deleted_at IS NULL`,
      [productId]
    )
  }

  /**
   * Top-K productos más similares al embedding query (cosine distance).
   * Devuelve sólo product_ids que NO estén soft-deleted.
   */
  async findSimilarProducts(args: {
    embedding: number[]
    limit?: number
  }): Promise<SimilarProduct[]> {
    const { embedding, limit = 5 } = args
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return []
    }
    const manager = this.getRawManager()
    const vec = `[${embedding.join(",")}]`
    const result = await manager.execute(
      `SELECT product_id, source_text, embedding <=> ?::vector AS distance
         FROM product_embedding
        WHERE deleted_at IS NULL
        ORDER BY embedding <=> ?::vector
        LIMIT ?`,
      [vec, vec, limit]
    )
    const rows: SimilarProduct[] = Array.isArray(result) ? result : result?.rows ?? []
    return rows
  }

  protected getRawManager(): RawManager {
    const self = this as any
    const candidates = [
      "__productEmbeddingRepository__",
      "productEmbeddingService_",
      "productEmbedding_",
    ]
    for (const key of candidates) {
      const target = self[key]
      if (target?.getActiveManager) {
        return target.getActiveManager() as RawManager
      }
      if (target?.__container__) {
        const repo = target.__container__["productEmbeddingRepository"]
        if (repo?.getActiveManager) {
          return repo.getActiveManager() as RawManager
        }
      }
    }
    const container = self.__container__
    if (container) {
      const repo = container["productEmbeddingRepository"]
      if (repo?.getActiveManager) {
        return repo.getActiveManager() as RawManager
      }
      const mgr = container["manager"]
      if (mgr?.execute) return mgr as RawManager
    }
    throw new Error(
      `ai-assistant: cannot resolve EntityManager (keys: ${Object.keys(self).join(",")})`
    )
  }
}

export default AiAssistantModuleService
