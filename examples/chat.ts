import { createQwen, type Tool } from "../src"

const TOKEN = process.env.QWEN_TOKEN
if (!TOKEN) {
  console.error("Set QWEN_TOKEN env variable (JWT token from cookie)")
  process.exit(1)
}

const qwen = createQwen({ token: TOKEN })

const tools: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather for a city",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name" },
        },
        required: ["city"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web for information",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
  },
]

console.log("Chat with Qwen (type 'q' to exit, 'new' for new chat, 'tools' to toggle tools)\n")

let useTools = false

for await (const line of console) {
  if (line === "q") break
  if (!line.trim()) continue

  if (line === "new") {
    qwen.newChat()
    console.log("Started new chat\n")
    continue
  }

  if (line === "tools") {
    useTools = !useTools
    console.log(`Tools: ${useTools ? "ON" : "OFF"}\n`)
    continue
  }

  const options = useTools ? { tools } : undefined

  for await (const chunk of qwen.chatStream(line, options)) {
    if (typeof chunk === "string") {
      process.stdout.write(chunk)
    } else {
      console.log("\n[TOOL CALL]", chunk.function.name, chunk.function.arguments)
    }
  }
  console.log("\n")
}
