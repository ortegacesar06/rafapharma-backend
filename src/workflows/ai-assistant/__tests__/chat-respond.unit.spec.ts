import {
  buildAnthropicMessages,
  buildContextBlock,
} from "../chat-respond"

describe("buildContextBlock", () => {
  it("returns placeholder when no products", () => {
    expect(buildContextBlock([])).toContain("no hay productos")
  })

  it("numbers products and trims excessive whitespace", () => {
    const block = buildContextBlock([
      { product_id: "p1", source_text: "Whey   Protein\n\nBuena para masa", distance: 0.1 },
      { product_id: "p2", source_text: "Creatina micronizada", distance: 0.2 },
    ])
    expect(block).toContain("1. Whey Protein Buena para masa")
    expect(block).toContain("2. Creatina micronizada")
  })

  it("truncates very long source_text to 600 chars", () => {
    const long = "x".repeat(1000)
    const block = buildContextBlock([
      { product_id: "p1", source_text: long, distance: 0 },
    ])
    // 600 chars + "1. " prefix
    expect(block.length).toBeLessThanOrEqual(600 + 5)
  })
})

describe("buildAnthropicMessages", () => {
  it("filters system messages", () => {
    const out = buildAnthropicMessages([
      { role: "system", content: "ignored" },
      { role: "user", content: "hola" },
    ])
    expect(out).toEqual([{ role: "user", content: "hola" }])
  })

  it("merges consecutive same-role messages", () => {
    const out = buildAnthropicMessages([
      { role: "user", content: "primera parte" },
      { role: "user", content: "segunda parte" },
      { role: "assistant", content: "respondo" },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({
      role: "user",
      content: "primera parte\n\nsegunda parte",
    })
    expect(out[1].role).toBe("assistant")
  })

  it("drops leading assistant messages so the first turn is user", () => {
    const out = buildAnthropicMessages([
      { role: "assistant", content: "saludo previo huérfano" },
      { role: "user", content: "hola" },
    ])
    expect(out[0].role).toBe("user")
    expect(out[0].content).toBe("hola")
  })

  it("returns empty array when there are no user messages", () => {
    const out = buildAnthropicMessages([
      { role: "assistant", content: "solo asistente" },
    ])
    expect(out).toEqual([])
  })
})
