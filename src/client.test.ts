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
    const originalFetch = globalThis.fetch

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    test("throws error if login not called first", async () => {
      const client = new QwenClient()

      await expect(client.waitForAuth()).rejects.toThrow("Call login() first")
    })

    test("successfully completes authentication flow", async () => {
      let callCount = 0
      globalThis.fetch = mock((url: string) => {
        callCount++
        
        if (url.includes("/device/code")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                device_code: "device123",
                user_code: "ABC-123",
                verification_uri: "https://example.com",
                verification_uri_complete: "https://example.com?code=ABC-123",
                expires_in: 600,
                interval: 1,
              }),
              { status: 200 }
            )
          )
        }
        
        if (url.includes("/token")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: "access123",
                refresh_token: "refresh123",
                expires_in: 3600,
              }),
              { status: 200 }
            )
          )
        }
        
        return Promise.resolve(new Response("Not found", { status: 404 }))
      }) as unknown as typeof fetch

      const client = new QwenClient()
      await client.login()
      await client.waitForAuth()

      const tokens = client.getTokens()
      expect(tokens?.accessToken).toBe("access123")
      expect(tokens?.refreshToken).toBe("refresh123")
      expect(callCount).toBe(2)
    })
  })

  describe("authenticate", () => {
    const originalFetch = globalThis.fetch
    const originalConsoleLog = console.log

    beforeEach(() => {
      console.log = mock(() => {})
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
      console.log = originalConsoleLog
    })

    test("completes full authentication flow with console output", async () => {
      globalThis.fetch = mock((url: string) => {
        if (url.includes("/device/code")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                device_code: "device123",
                user_code: "ABC-123",
                verification_uri: "https://example.com",
                verification_uri_complete: "https://example.com?code=ABC-123",
                expires_in: 600,
                interval: 0.1,
              }),
              { status: 200 }
            )
          )
        }
        
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: "access123",
              refresh_token: "refresh123",
              expires_in: 3600,
            }),
            { status: 200 }
          )
        )
      }) as unknown as typeof fetch

      const client = new QwenClient()
      await client.authenticate()

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("https://example.com?code=ABC-123"))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("ABC-123"))
      expect(console.log).toHaveBeenCalledWith("Authenticated successfully!\n")
      
      const tokens = client.getTokens()
      expect(tokens?.accessToken).toBe("access123")
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

    test("automatically refreshes expired token", async () => {
      let callCount = 0
      globalThis.fetch = mock((url: string, options: RequestInit) => {
        callCount++
        
        if (url.includes("/token") && callCount === 1) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: "new-token",
                refresh_token: "new-refresh",
                expires_in: 3600,
              }),
              { status: 200 }
            )
          )
        }
        
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "chat-123",
              choices: [{ index: 0, message: { role: "assistant", content: "Response" }, finish_reason: "stop" }],
            }),
            { status: 200 }
          )
        )
      }) as unknown as typeof fetch

      const client = new QwenClient()
      client.setTokens("expired-token", "refresh-token")
      
      client["tokens"]!.expiresAt = Date.now() - 1000

      const response = await client.chat([{ role: "user", content: "Hi" }])

      expect(callCount).toBe(2)
      expect(response.choices[0]!.message.content).toBe("Response")
    })

    test("handles API errors gracefully", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response("Rate limit exceeded", { status: 429 }))
      ) as unknown as typeof fetch

      const client = new QwenClient({ accessToken: "test-token" })

      await expect(
        client.chat([{ role: "user", content: "Hi" }])
      ).rejects.toThrow("Request failed: 429")
    })

    test("includes temperature in request when provided", async () => {
      let capturedBody: string | undefined

      globalThis.fetch = mock((url: string, options: RequestInit) => {
        capturedBody = options.body as string
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "chat-123",
              choices: [{ index: 0, message: { role: "assistant", content: "Hi" }, finish_reason: "stop" }],
            }),
            { status: 200 }
          )
        )
      }) as unknown as typeof fetch

      const client = new QwenClient({ accessToken: "test-token" })
      await client.chat([{ role: "user", content: "Hi" }], { temperature: 0.7 })

      const body = JSON.parse(capturedBody!)
      expect(body.temperature).toBe(0.7)
    })
  })

  describe("chatStream", () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    test("streams chat response correctly", async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" there"}}]}\n',
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
      const result: string[] = []

      for await (const chunk of client.chatStream("Hi")) {
        result.push(chunk)
      }

      expect(result).toEqual(["Hello", " there", "!"])
    })

    test("accepts string input and converts to messages", async () => {
      let capturedBody: string | undefined

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n'))
          controller.enqueue(encoder.encode("data: [DONE]\n"))
          controller.close()
        },
      })

      globalThis.fetch = mock((url: string, options: RequestInit) => {
        capturedBody = options.body as string
        return Promise.resolve(new Response(stream, { status: 200 }))
      }) as unknown as typeof fetch

      const client = new QwenClient({ accessToken: "test-token" })
      
      for await (const chunk of client.chatStream("Hello")) {
        break
      }

      const body = JSON.parse(capturedBody!)
      expect(body.messages).toEqual([{ role: "user", content: "Hello" }])
      expect(body.stream).toBe(true)
    })

    test("handles malformed JSON chunks gracefully", async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Good"}}]}\n',
        'data: invalid json\n',
        'data: {"choices":[{"delta":{"content":" response"}}]}\n',
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
      const result: string[] = []

      for await (const chunk of client.chatStream("Hi")) {
        result.push(chunk)
      }

      expect(result).toEqual(["Good", " response"])
    })

    test("throws error when not authenticated", async () => {
      const client = new QwenClient()

      const generator = client.chatStream("Hi")
      await expect(generator.next()).rejects.toThrow("Not authenticated")
    })

    test("handles empty response body", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(null, { status: 200 }))
      ) as unknown as typeof fetch

      const client = new QwenClient({ accessToken: "test-token" })

      const generator = client.chatStream("Hi")
      await expect(generator.next()).rejects.toThrow("No response body")
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

    test("returns empty string for empty stream", async () => {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("data: [DONE]\n"))
          controller.close()
        },
      })

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(stream, { status: 200 }))
      ) as unknown as typeof fetch

      const client = new QwenClient({ accessToken: "test-token" })
      const result = await client.ask("Hi")

      expect(result).toBe("")
    })

    test("passes options to chatStream", async () => {
      let capturedBody: string | undefined

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n'))
          controller.enqueue(encoder.encode("data: [DONE]\n"))
          controller.close()
        },
      })

      globalThis.fetch = mock((url: string, options: RequestInit) => {
        capturedBody = options.body as string
        return Promise.resolve(new Response(stream, { status: 200 }))
      }) as unknown as typeof fetch

      const client = new QwenClient({ accessToken: "test-token" })
      await client.ask("Hi", { model: "qwen-max", temperature: 0.8 })

      const body = JSON.parse(capturedBody!)
      expect(body.model).toBe("qwen-max")
      expect(body.temperature).toBe(0.8)
    })
  })
})
  describe("edge cases and error handling", () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    test("handles token refresh failure gracefully", async () => {
      globalThis.fetch = mock((url: string) => {
        if (url.includes("/token")) {
          return Promise.resolve(new Response("Refresh failed", { status: 401 }))
        }
        return Promise.resolve(new Response("Chat response", { status: 200 }))
      }) as unknown as typeof fetch

      const client = new QwenClient()
      client.setTokens("expired-token", "invalid-refresh")
      client["tokens"]!.expiresAt = Date.now() - 1000

      await expect(
        client.chat([{ role: "user", content: "Hi" }])
      ).rejects.toThrow("Token refresh failed")
    })

    test("handles missing refresh token when token expired", async () => {
      globalThis.fetch = mock((url: string) => {
        return Promise.resolve(new Response("Unauthorized", { status: 401 }))
      }) as unknown as typeof fetch

      const client = new QwenClient()
      client.setTokens("expired-token")
      client["tokens"]!.expiresAt = Date.now() - 1000

      await expect(
        client.chat([{ role: "user", content: "Hi" }])
      ).rejects.toThrow("Request failed: 401")
    })

    test("chatStream handles network interruption", async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error("Network interrupted"))) as unknown as typeof fetch

      const client = new QwenClient({ accessToken: "test-token" })
      const generator = client.chatStream("Hi")

      await expect(generator.next()).rejects.toThrow("Network interrupted")
    })

    test("handles partial JSON chunks in stream", async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"con',
        'tent":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n',
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
      const result: string[] = []

      for await (const chunk of client.chatStream("Hi")) {
        result.push(chunk)
      }

      expect(result).toEqual(["Hello", " world"])
    })

    test("validates constructor parameters", () => {
      const client1 = new QwenClient({ model: "" })
      expect(client1.getModel()).toBe("")

      const client2 = new QwenClient({ accessToken: "test", refreshToken: "refresh" })
      const tokens = client2.getTokens()
      expect(tokens?.accessToken).toBe("test")
      expect(tokens?.refreshToken).toBe("refresh")
    })

    test("login handles device code request failure", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response("Service unavailable", { status: 503 }))
      ) as unknown as typeof fetch

      const client = new QwenClient()

      await expect(client.login()).rejects.toThrow("Device code request failed: 503")
    })

    test("authenticate handles polling failure", async () => {
      const originalConsoleLog = console.log
      console.log = mock(() => {})

      globalThis.fetch = mock((url: string) => {
        if (url.includes("/device/code")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                device_code: "device123",
                user_code: "ABC-123",
                verification_uri: "https://example.com",
                verification_uri_complete: "https://example.com?code=ABC-123",
                expires_in: 600,
                interval: 0.1,
              }),
              { status: 200 }
            )
          )
        }
        
        return Promise.resolve(
          new Response(JSON.stringify({ error: "expired_token" }), { status: 400 })
        )
      }) as unknown as typeof fetch

      const client = new QwenClient()

      await expect(client.authenticate()).rejects.toThrow("expired_token")

      console.log = originalConsoleLog
    })
  })
