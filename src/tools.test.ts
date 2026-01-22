import { describe, test, expect, mock } from "bun:test"
import { QwenClient } from "./client"
import type { Tool, ChatMessage } from "./types"

const mockFetch = (response: any) => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify(response)))
  ) as any
}

describe("QwenClient Tool Calls", () => {
  test("sends tools in chat request", async () => {
    const mockResponse = {
      id: "chat-123",
      object: "chat.completion",
      created: 1234567890,
      model: "coder-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "I'll help you get the weather.",
            tool_calls: [
              {
                id: "call_123",
                type: "function",
                function: {
                  name: "get_weather",
                  arguments: '{"location": "Moscow"}',
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    }

    mockFetch(mockResponse)

    const client = new QwenClient({ accessToken: "test-token" })

    const tools: Tool[] = [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get current weather for a location",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string" },
            },
            required: ["location"],
          },
        },
      },
    ]

    const messages: ChatMessage[] = [
      { role: "user", content: "What's the weather in Moscow?" },
    ]

    const response = await client.chat(messages, { tools })

    expect(fetch).toHaveBeenCalledWith(
      "https://portal.qwen.ai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        }),
        body: JSON.stringify({
          model: "coder-model",
          messages,
          stream: false,
          tools,
        }),
      })
    )

    expect(response.choices[0]!.message.tool_calls).toHaveLength(1)
    expect(response.choices[0]!.message.tool_calls![0]!.function.name).toBe("get_weather")
  })

  test("sends tool_choice in chat request", async () => {
    const mockResponse = {
      id: "chat-123",
      object: "chat.completion",
      created: 1234567890,
      model: "coder-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_123",
                type: "function",
                function: {
                  name: "get_weather",
                  arguments: '{"location": "Moscow"}',
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    }

    mockFetch(mockResponse)

    const client = new QwenClient({ accessToken: "test-token" })

    const tools: Tool[] = [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather",
          parameters: { type: "object", properties: {} },
        },
      },
    ]

    const messages: ChatMessage[] = [
      { role: "user", content: "Get weather" },
    ]

    await client.chat(messages, {
      tools,
      tool_choice: { type: "function", function: { name: "get_weather" } },
    })

    expect(fetch).toHaveBeenCalledWith(
      "https://portal.qwen.ai/v1/chat/completions",
      expect.objectContaining({
        body: JSON.stringify({
          model: "coder-model",
          messages,
          stream: false,
          tools,
          tool_choice: { type: "function", function: { name: "get_weather" } },
        }),
      })
    )
  })

  test("creates tool result message", () => {
    const client = new QwenClient()

    const toolResult = client.createToolResult("call_123", "Weather is sunny, 25°C")

    expect(toolResult).toEqual({
      role: "tool",
      content: "Weather is sunny, 25°C",
      tool_call_id: "call_123",
    })
  })

  test("handles complete tool call flow", async () => {
    let callCount = 0

    globalThis.fetch = mock(() => {
      callCount++

      if (callCount === 1) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "chat-123",
              object: "chat.completion",
              created: 1234567890,
              model: "coder-model",
              choices: [
                {
                  index: 0,
                  message: {
                    role: "assistant",
                    content: null,
                    tool_calls: [
                      {
                        id: "call_123",
                        type: "function",
                        function: {
                          name: "get_weather",
                          arguments: '{"location": "Moscow"}',
                        },
                      },
                    ],
                  },
                  finish_reason: "tool_calls",
                },
              ],
            })
          )
        )
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "chat-124",
            object: "chat.completion",
            created: 1234567891,
            model: "coder-model",
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: "The weather in Moscow is sunny with 25°C temperature.",
                },
                finish_reason: "stop",
              },
            ],
          })
        )
      )
    }) as any

    const client = new QwenClient({ accessToken: "test-token" })

    const tools: Tool[] = [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string" },
            },
            required: ["location"],
          },
        },
      },
    ]

    const messages: ChatMessage[] = [
      { role: "user", content: "What's the weather in Moscow?" },
    ]

    const firstResponse = await client.chat(messages, { tools })
    const toolCall = firstResponse.choices[0]!.message.tool_calls![0]!

    expect(toolCall.function.name).toBe("get_weather")
    expect(JSON.parse(toolCall.function.arguments)).toEqual({ location: "Moscow" })

    const toolResult = client.createToolResult(toolCall.id, "Sunny, 25°C")

    const updatedMessages: ChatMessage[] = [
      ...messages,
      firstResponse.choices[0]!.message,
      toolResult,
    ]

    const finalResponse = await client.chat(updatedMessages)

    expect(finalResponse.choices[0]!.message.content).toContain("sunny")
    expect(finalResponse.choices[0]!.message.content).toContain("25°C")
    expect(callCount).toBe(2)
  })

  test("handles tool_choice none", async () => {
    const mockResponse = {
      id: "chat-123",
      object: "chat.completion",
      created: 1234567890,
      model: "coder-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "I can help you with weather, but I won't call any tools right now.",
          },
          finish_reason: "stop",
        },
      ],
    }

    mockFetch(mockResponse)

    const client = new QwenClient({ accessToken: "test-token" })

    const tools: Tool[] = [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather",
          parameters: { type: "object", properties: {} },
        },
      },
    ]

    const response = await client.chat(
      [{ role: "user", content: "Tell me about weather tools" }],
      { tools, tool_choice: "none" }
    )

    expect(fetch).toHaveBeenCalledWith(
      "https://portal.qwen.ai/v1/chat/completions",
      expect.objectContaining({
        body: JSON.stringify({
          model: "coder-model",
          messages: [{ role: "user", content: "Tell me about weather tools" }],
          stream: false,
          tools,
          tool_choice: "none",
        }),
      })
    )

    expect(response.choices[0]!.message.tool_calls).toBeUndefined()
    expect(response.choices[0]!.message.content).toContain("tools")
  })
})