import { buildFlashRequests } from "../decrement-flash-units"

describe("buildFlashRequests", () => {
  it("returns empty when order has no items", () => {
    expect(buildFlashRequests({})).toEqual([])
  })

  it("returns empty when no item has a promotion adjustment", () => {
    expect(
      buildFlashRequests({
        items: [{ quantity: 2, adjustments: [] }, { quantity: 1 }],
      })
    ).toEqual([])
  })

  it("aggregates quantity per promotion across items", () => {
    const result = buildFlashRequests({
      items: [
        { quantity: 2, adjustments: [{ promotion_id: "p1" }] },
        { quantity: 3, adjustments: [{ promotion_id: "p1" }] },
        { quantity: 5, adjustments: [{ promotion_id: "p2" }] },
      ],
    })
    expect(result.sort((a, b) => a.promotion_id.localeCompare(b.promotion_id))).toEqual([
      { promotion_id: "p1", quantity: 5 },
      { promotion_id: "p2", quantity: 5 },
    ])
  })

  it("counts an item once per promotion when multiple adjustments reference the same promo", () => {
    const result = buildFlashRequests({
      items: [
        {
          quantity: 4,
          adjustments: [{ promotion_id: "p1" }, { promotion_id: "p1" }],
        },
      ],
    })
    expect(result).toEqual([{ promotion_id: "p1", quantity: 4 }])
  })

  it("ignores items with non-positive quantities", () => {
    const result = buildFlashRequests({
      items: [
        { quantity: 0, adjustments: [{ promotion_id: "p1" }] },
        { quantity: 2, adjustments: [{ promotion_id: "p1" }] },
      ],
    })
    expect(result).toEqual([{ promotion_id: "p1", quantity: 2 }])
  })
})
