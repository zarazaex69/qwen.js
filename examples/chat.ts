import { createQwen } from "../src"

const TOKENS_FILE = "tokens.json"

const file = Bun.file(TOKENS_FILE)
const saved = (await file.exists()) ? await file.json() : null
const qwen = createQwen(saved ?? {})

if (!saved) {
  const { url } = await qwen.login()
  console.log("Open:", url)
  await qwen.waitForAuth()
  await Bun.write(TOKENS_FILE, JSON.stringify(qwen.getTokens()))
  console.log("Saved tokens")
}

console.log("\nChat (type 'q' to exit)\n")

for await (const line of console) {
  if (line === "q") break
  if (!line.trim()) continue

  for await (const chunk of qwen.chatStream(line)) {
    process.stdout.write(chunk)
  }
  console.log("\n")
}
