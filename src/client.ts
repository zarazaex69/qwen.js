import type {
  QwenConfig,
  ChatMessage,
  CreateChatResponse,
  StreamChunk,
  StreamCreatedEvent,
  ChatSession,
  QwenMessage,
  ChatOptions,
  Tool,
  ToolCall,
} from "./types"

const API_BASE = "https://chat.qwen.ai/api/v2"
const DEFAULT_MODEL = "qwen-max-latest"

function generateUUID(): string {
  return crypto.randomUUID()
}

function formatTimezone(): string {
  const d = new Date()
  const offset = d.toString().match(/GMT([+-]\d{4})/)
  const tz = offset ? offset[1] : "+0000"
  return `${d.toDateString()} ${d.toTimeString().split(" ")[0]} GMT${tz}`
}

export class QwenClient {
  private token: string
  private model: string
  private cookies: string
  private session: ChatSession | null = null

  constructor(config: QwenConfig) {
    this.token = config.token
    this.model = config.model ?? DEFAULT_MODEL
    this.cookies = config.cookies ?? `token=${config.token}`
  }

  private getHeaders(requestId?: string): Record<string, string> {
    return {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:146.0) Gecko/20100101 Firefox/146.0",
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.5",
      "Content-Type": "application/json",
      Version: "0.1.31",
      source: "web",
      "X-Request-Id": requestId ?? generateUUID(),
      Timezone: formatTimezone(),
      Origin: "https://chat.qwen.ai",
      Cookie: this.cookies,
    }
  }

  async createChat(title = "New Chat"): Promise<string> {
    const response = await fetch(`${API_BASE}/chats/new`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        title,
        models: [this.model],
        chat_mode: "normal",
        chat_type: "t2t",
        timestamp: Date.now(),
        project_id: "",
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Create chat failed: ${response.status} - ${error}`)
    }

    const data = (await response.json()) as CreateChatResponse
    if (!data.success) {
      throw new Error("Create chat failed: success=false")
    }

    this.session = {
      chatId: data.data.id,
      parentId: null,
      model: this.model,
    }

    return data.data.id
  }


  private buildMessage(content: string, thinkingEnabled = false): QwenMessage {
    const fid = generateUUID()
    return {
      fid,
      parentId: this.session?.parentId ?? null,
      childrenIds: [generateUUID()],
      role: "user",
      content,
      user_action: "chat",
      files: [],
      timestamp: Math.floor(Date.now() / 1000),
      models: [this.model],
      chat_type: "t2t",
      feature_config: {
        thinking_enabled: thinkingEnabled,
        output_schema: "phase",
        research_mode: "normal",
      },
      extra: {
        meta: {
          subChatType: "t2t",
        },
      },
      sub_chat_type: "t2t",
      parent_id: this.session?.parentId ?? null,
    }
  }

  async *chatStream(
    content: string,
    options?: ChatOptions
  ): AsyncGenerator<string | ToolCall, void, unknown> {
    if (!this.session) {
      await this.createChat()
    }

    const chatId = this.session!.chatId
    const message = this.buildMessage(content, options?.thinkingEnabled)

    const body: Record<string, unknown> = {
      stream: true,
      version: "2.1",
      incremental_output: true,
      chat_id: chatId,
      chat_mode: "normal",
      model: this.model,
      parent_id: this.session!.parentId,
      messages: [message],
      timestamp: Date.now(),
    }

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools
    }

    const response = await fetch(`${API_BASE}/chat/completions?chat_id=${chatId}`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "X-Accel-Buffering": "no",
        Referer: `https://chat.qwen.ai/c/${chatId}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Chat stream failed: ${response.status} - ${error}`)
    }

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
        if (!data) continue

        try {
          const parsed = JSON.parse(data) as StreamChunk & StreamCreatedEvent

          if (parsed["response.created"]) {
            this.session!.parentId = parsed["response.created"].parent_id
            continue
          }

          const delta = parsed.choices?.[0]?.delta
          if (!delta) continue

          if (delta.status === "finished") {
            return
          }

          if (delta.tool_calls && delta.tool_calls.length > 0) {
            for (const tc of delta.tool_calls) {
              yield tc
            }
          }

          if (delta.content) {
            yield delta.content
          }
        } catch {
          continue
        }
      }
    }
  }

  async chat(content: string): Promise<string> {
    let result = ""
    for await (const chunk of this.chatStream(content)) {
      result += chunk
    }
    return result
  }

  async ask(prompt: string): Promise<string> {
    return this.chat(prompt)
  }

  newChat(): void {
    this.session = null
  }

  getSession(): ChatSession | null {
    return this.session
  }

  setModel(model: string): void {
    this.model = model
  }
}
