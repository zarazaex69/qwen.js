export interface QwenConfig {
  clientId?: string
  accessToken?: string
  refreshToken?: string
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

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface ChatRequest {
  model?: string
  messages: ChatMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

export interface ChatChoice {
  index: number
  message: ChatMessage
  finish_reason: string
}

export interface ChatResponse {
  id: string
  object: string
  created: number
  model: string
  choices: ChatChoice[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface StreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    delta: { content?: string; role?: string }
    finish_reason: string | null
  }[]
}

export interface AuthState {
  accessToken: string
  refreshToken: string
  expiresAt: number
}
