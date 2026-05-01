import { BrevoContactsModuleService } from "../service"

const mockContacts = {
  createContact: jest.fn(),
  updateContact: jest.fn(),
  deleteContact: jest.fn(),
  getContactsFromList: jest.fn(),
  addContactToList: jest.fn(),
  removeContactFromList: jest.fn(),
}

jest.mock("@getbrevo/brevo", () => ({
  BrevoClient: jest.fn().mockImplementation(() => ({ contacts: mockContacts })),
}))

const makeService = (
  overrides: Partial<ConstructorParameters<typeof BrevoContactsModuleService>[1]> = {}
) => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any
  const options = { api_key: "test-key", default_list_id: 7, segments: { vip: 99 }, ...overrides }
  return new BrevoContactsModuleService({ logger }, options)
}

beforeEach(() => {
  Object.values(mockContacts).forEach((m) => m.mockReset())
})

describe("BrevoContactsModuleService", () => {
  it("requires api_key", () => {
    expect(() => new BrevoContactsModuleService({ logger: {} as any }, {} as any)).toThrow(/api_key/)
  })

  it("upsertContact uses default list when no listIds passed", async () => {
    const svc = makeService()
    mockContacts.createContact.mockResolvedValueOnce({})
    await svc.upsertContact("a@b.com", { FNAME: "Ana" })
    expect(mockContacts.createContact).toHaveBeenCalledWith({
      email: "a@b.com",
      attributes: { FNAME: "Ana" },
      listIds: [7],
      updateEnabled: true,
    })
  })

  it("upsertContact respects explicit listIds", async () => {
    const svc = makeService()
    mockContacts.createContact.mockResolvedValueOnce({})
    await svc.upsertContact("a@b.com", undefined, [42, 43])
    expect(mockContacts.createContact).toHaveBeenCalledWith(
      expect.objectContaining({ listIds: [42, 43] })
    )
  })

  it("upsertContact omits listIds when no default and no override", async () => {
    const svc = makeService({ default_list_id: undefined } as any)
    mockContacts.createContact.mockResolvedValueOnce({})
    await svc.upsertContact("a@b.com")
    expect(mockContacts.createContact).toHaveBeenCalledWith({
      email: "a@b.com",
      attributes: undefined,
      listIds: undefined,
      updateEnabled: true,
    })
  })

  it("resolveSegmentListId maps segment name → list id, falls back to default when null", () => {
    const svc = makeService()
    expect(svc.resolveSegmentListId("vip")).toBe(99)
    expect(svc.resolveSegmentListId(null)).toBe(7)
    expect(svc.resolveSegmentListId("missing")).toBeUndefined()
  })

  it("getListContacts paginates until page < pageSize and dedups via collect", async () => {
    const svc = makeService()
    const big = Array.from({ length: 500 }, (_, i) => ({ email: `u${i}@x.com` }))
    const tail = [{ email: "t1@x.com" }, { email: "t2@x.com" }]
    mockContacts.getContactsFromList
      .mockResolvedValueOnce({ contacts: big, count: 502 })
      .mockResolvedValueOnce({ contacts: tail, count: 502 })
    const emails = await svc.getListContacts(123)
    expect(emails).toHaveLength(502)
    expect(mockContacts.getContactsFromList).toHaveBeenNthCalledWith(1, {
      listId: 123,
      limit: 500,
      offset: 0,
    })
    expect(mockContacts.getContactsFromList).toHaveBeenNthCalledWith(2, {
      listId: 123,
      limit: 500,
      offset: 500,
    })
  })

  it("getListContacts skips contacts without email", async () => {
    const svc = makeService()
    mockContacts.getContactsFromList.mockResolvedValueOnce({
      contacts: [{ email: "a@x.com" }, {}, { email: "" }, { email: "b@x.com" }],
      count: 4,
    })
    const emails = await svc.getListContacts(1)
    expect(emails).toEqual(["a@x.com", "b@x.com"])
  })

  it("addToList / removeFromList wrap SDK calls", async () => {
    const svc = makeService()
    mockContacts.addContactToList.mockResolvedValueOnce({})
    mockContacts.removeContactFromList.mockResolvedValueOnce({})
    await svc.addToList("a@b.com", 5)
    await svc.removeFromList("a@b.com", 5)
    expect(mockContacts.addContactToList).toHaveBeenCalledWith({ listId: 5, emails: ["a@b.com"] })
    expect(mockContacts.removeContactFromList).toHaveBeenCalledWith({
      listId: 5,
      emails: ["a@b.com"],
    })
  })

  it("deleteContact uses email_id identifier type", async () => {
    const svc = makeService()
    mockContacts.deleteContact.mockResolvedValueOnce({})
    await svc.deleteContact("a@b.com")
    expect(mockContacts.deleteContact).toHaveBeenCalledWith({
      identifier: "a@b.com",
      identifierType: "email_id",
    })
  })
})
