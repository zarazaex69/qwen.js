export { QwenClient } from "./client"
export { extractToken, buildCookieString } from "./auth"
export type {
  QwenConfig,
  ChatMessage,
  ChatSession,
  ChatOptions,
  StreamChunk,
  CreateChatResponse,
} from "./types"

import { QwenClient } from "./client"

export function createQwen(config: { token: string; model?: string; cookies?: string }) {
  return new QwenClient(config)
}

export default QwenClient
