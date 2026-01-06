<div align="center">

![Bun](https://img.shields.io/badge/-Bun-0D1117?style=flat-square&logo=Bun&logoColor=F3E6D8)
![TypeScript](https://img.shields.io/badge/-TypeScript-0D1117?style=flat-square&logo=typescript&logoColor=3178C6)
![License](https://img.shields.io/badge/license-MIT-0D1117?style=flat-square&logo=open-source-initiative&logoColor=green&labelColor=0D1117)

# qwen.js

Elegant TypeScript SDK for Qwen AI API

</div>

## About

Simple and powerful wrapper for Qwen AI API with OAuth/PKCE authentication. Built with Bun/TypeScript, zero external dependencies.

Features:
- OAuth/PKCE device flow authentication
- Automatic token refresh
- Streaming responses
- Full chat history support
- Simple `ask()` method for quick prompts

## Fast Start

```bash
# bun
bun add qwen.js

# npm
npm install qwen.js
```

## Quick Usage

```typescript
import { createQwen } from "qwen.js"

const qwen = createQwen()

await qwen.authenticate()

const answer = await qwen.ask("What is quantum computing?")
console.log(answer)
```

## API Usage

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

const { url, userCode } = await qwen.login()
console.log(`Open: ${url}`)
console.log(`Code: ${userCode}`)

await qwen.waitForAuth()

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

const tokens = qwen.getTokens()
await Bun.write("tokens.json", JSON.stringify(tokens))

const saved = await Bun.file("tokens.json").json()
const qwen2 = createQwen({
  accessToken: saved.accessToken,
  refreshToken: saved.refreshToken,
})
```

## Functions

### `createQwen(options?)`

Creates a new Qwen client.

| Option | Type | Description |
|--------|------|-------------|
| `accessToken` | `string` | Pre-existing access token |
| `refreshToken` | `string` | Pre-existing refresh token |
| `model` | `string` | Default model (default: `qwen-plus`) |

### Methods

| Method | Description |
|--------|-------------|
| `authenticate()` | Full OAuth flow with console prompts |
| `login()` | Get device code and auth URL |
| `waitForAuth()` | Poll for token after user authenticates |
| `setTokens(accessToken, refreshToken?)` | Set tokens manually |
| `getTokens()` | Get current auth state |
| `ask(prompt, options?)` | Simple prompt, returns string |
| `chat(messages, options?)` | Full chat, returns ChatResponse |
| `chatStream(messages, options?)` | Streaming chat, yields chunks |

## Development

```bash
git clone https://github.com/zarazaex/qwen.js.git
cd qwen.js

bun install

bun run build
```

## License

MIT

<div align="center">

---

### Contact

Telegram: [zarazaex](https://t.me/zarazaexe)<br>
Email: [zarazaex@tuta.io](mailto:zarazaex@tuta.io)<br>
Site: [zarazaex.xyz](https://zarazaex.xyz)

</div>
