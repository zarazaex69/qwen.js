import { QwenClient } from "../src/client"

const client = new QwenClient({
  accessToken: process.env.QWEN_ACCESS_TOKEN,
  refreshToken: process.env.QWEN_REFRESH_TOKEN,
  model: "qwen-vl-max",
})

const message = client.createImageMessage(
  "Что на этой картинке?",
  [
    "https://example.com/image.jpg",
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  ]
)

const response = await client.chat([message])
console.log(response.choices[0].message.content)

const streamMessage = client.createImageMessage(
  "Опиши детали",
  ["https://example.com/photo.png"]
)

for await (const chunk of client.chatStream([streamMessage])) {
  process.stdout.write(chunk)
}
