export interface QwenConfig {
  accessToken?: string
  refreshToken?: string
  model?: string
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface ChatOptions {
  model?: string
  temperature?: number
  stream?: boolean
  tools?: Tool[]
  tool_choice?: "none" | "auto" | { type: "function"; function: { name: string } }
}

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface TokenState {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface PKCEPair {
  verifier: string
  challenge: string
}

export interface ChatResponse {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    message: ChatMessage
    finish_reason: string
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface Tool {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, any>
  }
}

export interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export interface ToolResult {
  tool_call_id: string
  content: string
}

export interface StreamChunk {
  id?: string
  object?: string
  created?: number
  model?: string
  choices?: {
    index: number
    delta: {
      role?: string
      content?: string
      tool_calls?: ToolCall[]
    }
    finish_reason?: string | null
  }[]
}

export interface ChatSession {
  messages: ChatMessage[]
  model: string
}
