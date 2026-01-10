export interface QwenConfig {
  accessToken?: string
  refreshToken?: string
  model?: string
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface ChatOptions {
  model?: string
  temperature?: number
  stream?: boolean
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
    }
    finish_reason?: string | null
  }[]
}

export interface ChatSession {
  messages: ChatMessage[]
  model: string
}
