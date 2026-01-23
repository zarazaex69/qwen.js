export { QwenClient } from "./client"
export {
  generatePKCE,
  requestDeviceCode,
  pollForToken,
  refreshAccessToken,
  isTokenExpired,
} from "./auth"
export type {
  QwenConfig,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ChatSession,
  StreamChunk,
  TokenState,
  DeviceCodeResponse,
  TokenResponse,
  PKCEPair,
  Tool,
  ToolCall,
  ToolResult,
  ImageContent,
  TextContent,
  MessageContent,
} from "./types"

import { QwenClient } from "./client"

export function createQwen(config?: {
  accessToken?: string
  refreshToken?: string
  model?: string
}) {
  return new QwenClient(config)
}

export default QwenClient
