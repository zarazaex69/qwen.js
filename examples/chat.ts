import { createQwen } from "../src"

const qwen = createQwen()

await qwen.authenticate()

console.log("Chat with Qwen (type 'q' to exit)\n")

for await (const line of console) {
  if (line === "q") break
  if (!line.trim()) continue

  for await (const chunk of qwen.chatStream(line)) {
    process.stdout.write(chunk)
  }
  console.log("\n")
}
