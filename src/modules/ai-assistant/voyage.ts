/**
 * Cliente fino para Voyage AI embeddings (HTTP directo, sin SDK).
 * Docs: https://docs.voyageai.com/reference/embeddings-api
 */

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"

export type VoyageEmbedInput = {
  texts: string[]
  model: string
  apiKey: string
  inputType?: "query" | "document"
}

export type VoyageEmbedResult = {
  embeddings: number[][]
  total_tokens: number
}

export async function voyageEmbed(input: VoyageEmbedInput): Promise<VoyageEmbedResult> {
  const { texts, model, apiKey, inputType } = input
  if (!apiKey) throw new Error("voyageEmbed: VOYAGE_API_KEY missing")
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error("voyageEmbed: texts must be a non-empty array")
  }

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model,
      ...(inputType ? { input_type: inputType } : {}),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`voyageEmbed: HTTP ${res.status} ${res.statusText} — ${body.slice(0, 500)}`)
  }

  const json = (await res.json()) as {
    data: { embedding: number[]; index: number }[]
    usage: { total_tokens: number }
  }

  const sorted = [...json.data].sort((a, b) => a.index - b.index)
  return {
    embeddings: sorted.map((d) => d.embedding),
    total_tokens: json.usage?.total_tokens ?? 0,
  }
}

/**
 * Construye el texto a embedder para un producto. Concatena los campos
 * relevantes en español que un cliente usaría para buscar.
 */
export function buildProductSourceText(product: {
  title?: string | null
  subtitle?: string | null
  description?: string | null
  handle?: string | null
  type?: { value?: string | null } | null
  tags?: { value?: string | null }[] | null
  categories?: { name?: string | null }[] | null
}): string {
  const parts: string[] = []
  if (product.title) parts.push(product.title)
  if (product.subtitle) parts.push(product.subtitle)
  if (product.type?.value) parts.push(`Tipo: ${product.type.value}`)
  const cats = (product.categories || []).map((c) => c?.name).filter(Boolean)
  if (cats.length) parts.push(`Categorías: ${cats.join(", ")}`)
  const tags = (product.tags || []).map((t) => t?.value).filter(Boolean)
  if (tags.length) parts.push(`Tags: ${tags.join(", ")}`)
  if (product.description) parts.push(product.description)
  return parts.join("\n").trim()
}
