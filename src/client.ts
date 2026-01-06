import type { ChatMessage, ChatRequest, ChatResponse, StreamChunk, AuthState } from "./types"
import { QwenAuth } from "./auth"

const API_BASE_URL = "https://portal.qwen.ai/v1"
const DEFAULT_MODEL = "coder-model"

export class QwenClient {
  private auth: QwenAuth
  private authState: AuthState | null = null
  private model: string

  constructor(options: { accessToken?: string; refreshToken?: string; model?: string } = {}) {
    this.auth = new QwenAuth()
    this.model = options.model ?? DEFAULT_MODEL

    if (options.accessToken) {
      this.authState = {
        accessToken: options.accessToken,
        refreshToken: options.refreshToken ?? "",
        expiresAt: Date.now() + 6 * 60 * 60 * 1000,
      }
    }
  }

  async login(): Promise<{ url: string; userCode: string }> {
    return this.auth.requestDeviceCode()
  }

  async waitForAuth(): Promise<void> {
    this.authState = await this.auth.pollForToken()
  }

  async authenticate(): Promise<string> {
    const { url, userCode } = await this.login()
    console.log(`\nOpen this URL to authenticate:\n${url}\n`)
    console.log(`Your code: ${userCode}\n`)
    await this.waitForAuth()
    return this.authState!.accessToken
  }

  setTokens(accessToken: string, refreshToken?: string): void {
    this.authState = {
      accessToken,
      refreshToken: refreshToken ?? "",
      expiresAt: Date.now() + 6 * 60 * 60 * 1000,
    }
  }

  getTokens(): AuthState | null {
    return this.authState
  }

  private async ensureAuth(): Promise<string> {
    if (!this.authState) {
      throw new Error("Not authenticated. Call login() and waitForAuth() first, or use setTokens()")
    }

    if (this.authState.refreshToken && Date.now() > this.authState.expiresAt - 5 * 60 * 1000) {
      this.authState = await this.auth.refreshToken(this.authState.refreshToken)
    }

    return this.authState.accessToken
  }

  async chat(
    messages: ChatMessage[] | string,
    options: Partial<ChatRequest> = {}
  ): Promise<ChatResponse> {
    const token = await this.ensureAuth()

    const chatMessages: ChatMessage[] =
      typeof messages === "string" ? [{ role: "user", content: messages }] : messages

    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: options.model ?? this.model,
        messages: chatMessages,
        stream: false,
        ...options,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Chat request failed: ${response.status} - ${error}`)
    }

    return (await response.json()) as ChatResponse
  }

  async *chatStream(
    messages: ChatMessage[] | string,
    options: Partial<ChatRequest> = {}
  ): AsyncGenerator<string, void, unknown> {
    const token = await this.ensureAuth()

    const chatMessages: ChatMessage[] =
      typeof messages === "string" ? [{ role: "user", content: messages }] : messages

    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: options.model ?? this.model,
        messages: chatMessages,
        stream: true,
        ...options,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Chat stream failed: ${response.status} - ${error}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""
    let firstChunk: string | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6).trim()
        if (data === "[DONE]") return

        try {
          const chunk: StreamChunk = JSON.parse(data)
          const content = chunk.choices[0]?.delta?.content
          if (!content) continue

          if (firstChunk === null) {
            firstChunk = content
            yield content
            continue
          }

          if (content === firstChunk) {
            firstChunk = ""
            continue
          }

          yield content
        } catch {
          continue
        }
      }
    }
  }

  async ask(prompt: string, options: Partial<ChatRequest> = {}): Promise<string> {
    const response = await this.chat(prompt, options)
    return response.choices[0]?.message?.content ?? ""
  }
}
