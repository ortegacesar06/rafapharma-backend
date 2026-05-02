import { model } from "@medusajs/framework/utils"

/**
 * Embeddings de productos para RAG.
 *
 * La columna `embedding vector(512)` se agrega en la migración vía SQL raw
 * (model.define no conoce el tipo `vector` de pgvector). El servicio usa
 * SQL directo para upsert y búsqueda por similitud.
 */
const ProductEmbedding = model.define("product_embedding", {
  id: model.id().primaryKey(),
  product_id: model.text().unique(),
  embedding_model: model.text(),
  source_text: model.text(),
})

export default ProductEmbedding
