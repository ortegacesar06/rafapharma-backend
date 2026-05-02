import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { AI_ASSISTANT_MODULE } from "../index"
import AiAssistantModuleService from "../service"

jest.setTimeout(60_000)

moduleIntegrationTestRunner<AiAssistantModuleService>({
  moduleName: AI_ASSISTANT_MODULE,
  resolve: __dirname + "/..",
  testSuite: ({ service }) => {
    describe("AiAssistantModuleService", () => {
      it("creates a conversation with optional customer_id", async () => {
        const [anon] = await service.createConversations([{}])
        expect(anon.id).toMatch(/^conv_/)
        expect(anon.customer_id).toBeNull()

        const [linked] = await service.createConversations([
          { customer_id: "cus_test_123" },
        ])
        expect(linked.customer_id).toBe("cus_test_123")
      })

      it("creates messages and lists them ordered by created_at", async () => {
        const [conv] = await service.createConversations([{}])
        await service.createMessages([
          { conversation_id: conv.id, role: "user", content: "primera" },
          { conversation_id: conv.id, role: "assistant", content: "segunda" },
          { conversation_id: conv.id, role: "user", content: "tercera" },
        ])
        const all = await service.listMessages(
          { conversation_id: conv.id },
          { order: { created_at: "ASC" } }
        )
        expect(all).toHaveLength(3)
        expect(all.map((m) => m.role)).toEqual(["user", "assistant", "user"])
        expect(all[0].content).toBe("primera")
      })

      it("rejects messages with invalid role enum", async () => {
        const [conv] = await service.createConversations([{}])
        await expect(
          service.createMessages([
            { conversation_id: conv.id, role: "robot" as any, content: "x" },
          ])
        ).rejects.toThrow()
      })

      it("persists token counts on assistant messages", async () => {
        const [conv] = await service.createConversations([{}])
        const [msg] = await service.createMessages([
          {
            conversation_id: conv.id,
            role: "assistant",
            content: "respuesta",
            input_tokens: 120,
            output_tokens: 35,
          },
        ])
        expect(msg.input_tokens).toBe(120)
        expect(msg.output_tokens).toBe(35)
      })
    })
  },
})
