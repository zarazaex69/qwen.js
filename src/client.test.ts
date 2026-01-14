import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test"
import { QwenClient } from "./client"

describe("QwenClient", () => {
  describe("constructor", () => {
    test("creates client with default model", () => {
      const client = new QwenClient()

      expect(client.getModel()).toBe("qwen-plus")
    })

    test("creates client with custom model", () => {
      const client = new QwenClient({ model: "qwen-turbo" })

      expect(client.getModel()).toBe("qwen-turbo")
    })

    test("creates client with access token", () => {
      const client = new QwenClient({ accessToken: "test-token" })
      const tokens = client.getTokens()

      expect(tokens).not.toBeNull()
      expect(tokens?.accessToken).toBe("test-token")
    })

    test("creates client with access and refresh tokens", () => {
      const client = new QwenClient({
        accessToken: "access",
        refreshToken: "refresh",
      })
      const tokens = client.getTokens()

      expect(tokens?.accessToken).toBe("access")
      expect(tokens?.refreshToken).toBe("refresh")
    })
  })

  describe("setTokens / getTokens", () => {
    test("sets and gets tokens", () => {
      const client = new QwenClient()

      client.setTokens("new-access", "new-refresh")
      const tokens = client.getTokens()

      expect(tokens?.accessToken).toBe("new-access")
      expect(tokens?.refreshToken).toBe("new-refresh")
    })

    test("returns null when no tokens set", () => {
      const client = new QwenClient()

      expect(client.getTokens()).toBeNull()
    })

    test("getTokens returns a copy", () => {
      const client = new QwenClient({ accessToken: "test" })
      const tokens1 = client.getTokens()
      const tokens2 = client.getTokens()

      expect(tokens1).not.toBe(tokens2)
      expect(tokens1).toEqual(tokens2)
    })
  })

  describe("setModel / getModel", () => {
    test("changes model", () => {
      const client = new QwenClient()

      client.setModel("qwen-max")

      expect(client.getModel()).toBe("qwen-max")
    })
  })

  describe("login", () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    test("returns url and userCode", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              device_code: "device123",
              user_code: "ABC-123",
              verification_uri: "https://example.com",
              verification_uri_complete: "https://example.com?code=ABC-123",
              expires_in: 600,
              interval: 5,
            }),
            { status: 200 }
          )
        )
      ) as unknown as typeof fetch

      const client = new QwenClient()
      const result = await client.login()

      expect(result.url).toBe("https://example.com?code=ABC-123")
      expect(result.userCode).toBe("ABC-123")
    })
  })

  describe("waitForAuth", () => {
    test("throws error if login not called first", async () => {
      const client = new QwenClient()

      await expect(client.waitForAuth()).rejects.toThrow("Call login() first")
    })
  })

  describe("chat", () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    test("throws error when not authenticated", async () => {
      const client = new QwenClient()

      await expect(
        client.chat([{ role: "user", content: "Hello" }])
      ).rejects.toThrow("Not authenticated")
    })

    test("sends chat request with correct payload", async () => {
      let capturedBody: string | undefined

      globalThis.fetch = mock((url: string, options: RequestInit) => {
        capturedBody = options.body as string
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "chat-123",
              object: "chat.completion",
              created: Date.now(),
              model: "qwen-plus",
              choices: [
                {
                  index: 0,
                  message: { role: "assistant", content: "Hello!" },
                  finish_reason: "stop",
                },
              ],
            }),
            { status: 200 }
          )
        )
      }) as unknown as typeof fetch

      const client = new QwenClient({ accessToken: "test-token" })
      const response = await client.chat([{ role: "user", content: "Hi" }])

      expect(response.choices[0]!.message.content).toBe("Hello!")

      const body = JSON.parse(capturedBody!)
      expect(body.model).toBe("qwen-plus")
      expect(body.messages).toEqual([{ role: "user", content: "Hi" }])
      expect(body.stream).toBe(false)
    })

    test("uses custom model from options", async () => {
      let capturedBody: string | undefined

      globalThis.fetch = mock((url: string, options: RequestInit) => {
        capturedBody = options.body as string
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "chat-123",
              object: "chat.completion",
              created: Date.now(),
              model: "qwen-max",
              choices: [
                {
                  index: 0,
                  message: { role: "assistant", content: "Hi" },
                  finish_reason: "stop",
                },
              ],
            }),
            { status: 200 }
          )
        )
      }) as unknown as typeof fetch

      const client = new QwenClient({ accessToken: "test-token" })
      await client.chat([{ role: "user", content: "Hi" }], { model: "qwen-max" })

      const body = JSON.parse(capturedBody!)
      expect(body.model).toBe("qwen-max")
    })
  })

  describe("ask", () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    test("returns concatenated stream response", async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n',
        'data: {"choices":[{"delta":{"content":"!"}}]}\n',
        "data: [DONE]\n",
      ]

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        },
      })

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(stream, { status: 200 }))
      ) as unknown as typeof fetch

      const client = new QwenClient({ accessToken: "test-token" })
      const result = await client.ask("Hi")

      expect(result).toBe("Hello world!")
    })
  })
})
