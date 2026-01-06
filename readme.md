# qwen.js

Elegant TypeScript SDK for Qwen AI API with OAuth/PKCE authentication.

## Installation

```bash
# bun
bun add qwen.js

# npm
npm install qwen.js

# pnpm
pnpm add qwen.js
```

## Quick Start

```typescript
import { createQwen } from "qwen.js"

const qwen = createQwen()

// Authenticate (opens browser for OAuth)
await qwen.authenticate()

// Simple chat
const answer = await qwen.ask("What is quantum computing?")
console.log(answer)
```

## Usage

### With Existing Tokens

```typescript
import { createQwen } from "qwen.js"

const qwen = createQwen({
  accessToken: "your-access-token",
  refreshToken: "your-refresh-token",
})

const response = await qwen.ask("Hello!")
```

### Manual Authentication Flow

```typescript
import { createQwen } from "qwen.js"

const qwen = createQwen()

// Get auth URL
const { url, userCode } = await qwen.login()
console.log(`Open: ${url}`)
console.log(`Code: ${userCode}`)

// Wait for user to authenticate
await qwen.waitForAuth()

// Now you can chat
const answer = await qwen.ask("Hello!")
```

### Streaming Responses

```typescript
import { createQwen } from "qwen.js"

const qwen = createQwen({ accessToken: "..." })

for await (const chunk of qwen.chatStream("Tell me a story")) {
  process.stdout.write(chunk)
}
```

### Full Chat with Message History

```typescript
import { createQwen } from "qwen.js"

const qwen = createQwen({ accessToken: "..." })

const response = await qwen.chat([
  { role: "system", content: "You are a helpful assistant" },
  { role: "user", content: "What is 2+2?" },
  { role: "assistant", content: "4" },
  { role: "user", content: "And 3+3?" },
])

console.log(response.choices[0].message.content)
```

### Save and Restore Tokens

```typescript
import { createQwen } from "qwen.js"

const qwen = createQwen()
await qwen.authenticate()

// Save tokens for later
const tokens = qwen.getTokens()
await Bun.write("tokens.json", JSON.stringify(tokens))

// Later: restore tokens
const saved = await Bun.file("tokens.json").json()
const qwen2 = createQwen({
  accessToken: saved.accessToken,
  refreshToken: saved.refreshToken,
})
```

## API Reference

### `createQwen(options?)`

Creates a new Qwen client.

Options:
- `accessToken` - Pre-existing access token
- `refreshToken` - Pre-existing refresh token  
- `model` - Default model (default: `qwen-plus`)

### `QwenClient`

#### Methods

- `authenticate()` - Full OAuth flow with console prompts
- `login()` - Get device code and auth URL
- `waitForAuth()` - Poll for token after user authenticates
- `setTokens(accessToken, refreshToken?)` - Set tokens manually
- `getTokens()` - Get current auth state
- `ask(prompt, options?)` - Simple prompt, returns string
- `chat(messages, options?)` - Full chat, returns ChatResponse
- `chatStream(messages, options?)` - Streaming chat, yields chunks

## License

MIT
