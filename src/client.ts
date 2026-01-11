import type {
  QwenConfig,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  TokenState,
} from "./types"
import {
  generatePKCE,
  requestDeviceCode,
  pollForToken,
  refreshAccessToken,
  isTokenExpired,
} from "./auth"

const API_BASE = "https://portal.qwen.ai/v1"
const DEFAULT_MODEL = "qwen-plus"
const TOKEN_LIFETIME_MS = 6 * 60 * 60 * 1000

export class QwenClient {
  private tokens: TokenState | null = null
  private model: string
  private pendingAuth: { deviceCode: string; verifier: string; interval: number } | null = null

  constructor(config?: QwenConfig) {
    this.model = config?.model ?? DEFAULT_MODEL

    if (config?.accessToken) {
      this.tokens = {
        accessToken: config.accessToken,
        refreshToken: config.refreshToken ?? "",
        expiresAt: Date.now() + TOKEN_LIFETIME_MS,
      }
    }
  }

  async login(): Promise<{ url: string; userCode: string }> {
    const pkce = await generatePKCE()
    const response = await requestDeviceCode(pkce.challenge)

    this.pendingAuth = {
      deviceCode: response.device_code,
      verifier: pkce.verifier,
      interval: response.interval,
    }

    return {
      url: response.verification_uri_complete,
      userCode: response.user_code,
    }
  }

  async waitForAuth(): Promise<void> {
    if (!this.pendingAuth) {
      throw new Error("Call login() first")
    }

    const { deviceCode, verifier, interval } = this.pendingAuth
    const tokenResponse = await pollForToken(deviceCode, verifier, interval)

    this.tokens = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    }

    this.pendingAuth = null
  }

  async authenticate(): Promise<void> {
    const { url, userCode } = await this.login()
    console.log(`\nOpen this URL to authenticate:\n${url}\n`)
    console.log(`Code: ${userCode}\n`)
    console.log("Waiting for authorization...")
    await this.waitForAuth()
    console.log("Authenticated successfully!\n")
  }

  setTokens(accessToken: string, refreshToken?: string): void {
    this.tokens = {
      accessToken,
      refreshToken: refreshToken ?? "",
      expiresAt: Date.now() + TOKEN_LIFETIME_MS,
    }
  }

  getTokens(): TokenState | null {
    return this.tokens ? { ...this.tokens } : null
  }

  private async getValidToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error("Not authenticated. Call authenticate() or setTokens() first")
    }

    if (isTokenExpired(this.tokens) && this.tokens.refreshToken) {
      const newTokens = await refreshAccessToken(this.tokens.refreshToken)
      this.tokens = {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token,
        expiresAt: Date.now() + newTokens.expires_in * 1000,
      }
    }

    return this.tokens.accessToken
  }

  private async request(endpoint: string, body: object): Promise<Response> {
    const token = await this.getValidToken()
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Request failed: ${response.status} - ${error}`)
    }

    return response
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const response = await this.request("/chat/completions", {
      model: options?.model ?? this.model,
      messages,
      temperature: options?.temperature,
      stream: false,
    })

    return response.json() as Promise<ChatResponse>
  }

  async *chatStream(
    messages: ChatMessage[] | string,
    options?: ChatOptions
  ): AsyncGenerator<string, void, unknown> {
    const msgs: ChatMessage[] =
      typeof messages === "string" ? [{ role: "user", content: messages }] : messages

    const response = await this.request("/chat/completions", {
      model: options?.model ?? this.model,
      messages: msgs,
      temperature: options?.temperature,
      stream: true,
    })

    const reader = response.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""

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
          const content = chunk.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          continue
        }
      }
    }
  }

  async ask(prompt: string, options?: ChatOptions): Promise<string> {
    let result = ""
    for await (const chunk of this.chatStream(prompt, options)) {
      result += chunk
    }
    return result
  }

  setModel(model: string): void {
    this.model = model
  }

  getModel(): string {
    return this.model
  }
}
