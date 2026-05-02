import { buildProductSourceText } from "../voyage"

describe("buildProductSourceText", () => {
  it("returns empty string when no fields are present", () => {
    expect(buildProductSourceText({})).toBe("")
  })

  it("concatenates title, subtitle and description", () => {
    const text = buildProductSourceText({
      title: "Whey Protein 5lb",
      subtitle: "Concentrado",
      description: "Suplemento para ganancia muscular.",
    })
    expect(text).toContain("Whey Protein 5lb")
    expect(text).toContain("Concentrado")
    expect(text).toContain("Suplemento para ganancia muscular.")
  })

  it("includes type, categories and tags", () => {
    const text = buildProductSourceText({
      title: "Creatina",
      type: { value: "Suplemento" },
      categories: [{ name: "Energía" }, { name: "Pre-entreno" }],
      tags: [{ value: "vegano" }, { value: "sin azúcar" }],
    })
    expect(text).toContain("Tipo: Suplemento")
    expect(text).toContain("Categorías: Energía, Pre-entreno")
    expect(text).toContain("Tags: vegano, sin azúcar")
  })

  it("ignores nullish/undefined fields", () => {
    const text = buildProductSourceText({
      title: "BCAA",
      subtitle: null,
      description: undefined as any,
      tags: [{ value: null }, { value: "post-entreno" }],
      categories: null,
    })
    expect(text).toContain("BCAA")
    expect(text).toContain("Tags: post-entreno")
    expect(text).not.toContain("Tipo:")
    expect(text).not.toContain("Categorías:")
  })
})
