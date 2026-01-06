export interface QwenConfig {
  token: string
  model?: string
  cookies?: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface CreateChatRequest {
  title: string
  models: string[]
  chat_mode: string
  chat_type: string
  timestamp: number
  project_id: string
}

export interface CreateChatResponse {
  success: boolean
  request_id: string
  data: {
    id: string
  }
}

export interface QwenMessage {
  fid: string
  parentId: string | null
  childrenIds: string[]
  role: "user" | "assistant"
  content: string
  user_action: string
  files: unknown[]
  timestamp: number
  models: string[]
  chat_type: string
  feature_config: {
    thinking_enabled: boolean
    output_schema: string
    research_mode: string
  }
  extra: {
    meta: {
      subChatType: string
    }
  }
  sub_chat_type: string
  parent_id: string | null
}

export interface CompletionRequest {
  stream: boolean
  version: string
  incremental_output: boolean
  chat_id: string
  chat_mode: string
  model: string
  parent_id: string | null
  messages: QwenMessage[]
  timestamp: number
}

export interface StreamChunk {
  choices?: {
    delta: {
      role?: string
      content?: string
      phase?: string
      status?: string
      tool_calls?: ToolCall[]
    }
  }[]
  response_id?: string
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
}

export interface StreamCreatedEvent {
  "response.created"?: {
    chat_id: string
    parent_id: string
    response_id: string
  }
}

export interface ChatSession {
  chatId: string
  parentId: string | null
  model: string
}

export interface ToolFunction {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface Tool {
  type: "function"
  function: ToolFunction
}

export interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export interface ChatOptions {
  tools?: Tool[]
  thinkingEnabled?: boolean
}
