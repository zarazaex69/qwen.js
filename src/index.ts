export { QwenClient } from "./client"
export { QwenAuth } from "./auth"
export type {
  QwenConfig,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  AuthState,
  DeviceCodeResponse,
  TokenResponse,
} from "./types"

import { QwenClient } from "./client"

export function createQwen(options?: { accessToken?: string; refreshToken?: string; model?: string }) {
  return new QwenClient(options)
}

export default QwenClient
