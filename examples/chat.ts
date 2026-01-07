import { createQwen } from "../src"

const TOKEN = process.env.QWEN_TOKEN
if (!TOKEN) {
  console.error("Set QWEN_TOKEN env variable (JWT token from cookie)")
  process.exit(1)
}

const qwen = createQwen({ token: TOKEN })

console.log("Chat with Qwen (type 'q' to exit, 'new' for new chat)\n")

for await (const line of console) {
  if (line === "q") break
  if (!line.trim()) continue

  if (line === "new") {
    qwen.newChat()
    console.log("Started new chat\n")
    continue
  }

  for await (const chunk of qwen.chatStream(line)) {
    process.stdout.write(chunk)
  }
  console.log("\n")
}
