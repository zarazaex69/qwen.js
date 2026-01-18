import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test"
import {
  generatePKCE,
  isTokenExpired,
  requestDeviceCode,
  refreshAccessToken,
  pollForToken,
} from "./auth"
import type { TokenState } from "./types"

describe("generatePKCE", () => {
  test("returns verifier and challenge", async () => {
    const pkce = await generatePKCE()

    expect(pkce.verifier).toBeDefined()
    expect(pkce.challenge).toBeDefined()
    expect(pkce.verifier.length).toBe(43)
    expect(pkce.challenge.length).toBeGreaterThan(0)
  })

  test("generates unique values each time", async () => {
    const pkce1 = await generatePKCE()
    const pkce2 = await generatePKCE()

    expect(pkce1.verifier).not.toBe(pkce2.verifier)
    expect(pkce1.challenge).not.toBe(pkce2.challenge)
  })

  test("verifier contains only URL-safe characters", async () => {
    const pkce = await generatePKCE()
    const urlSafeRegex = /^[A-Za-z0-9_-]+$/

    expect(urlSafeRegex.test(pkce.verifier)).toBe(true)
    expect(urlSafeRegex.test(pkce.challenge)).toBe(true)
  })
})

describe("isTokenExpired", () => {
  test("returns false for valid token", () => {
    const state: TokenState = {
      accessToken: "test",
      refreshToken: "test",
      expiresAt: Date.now() + 120000,
    }

    expect(isTokenExpired(state)).toBe(false)
  })

  test("returns true for expired token", () => {
    const state: TokenState = {
      accessToken: "test",
      refreshToken: "test",
      expiresAt: Date.now() - 1000,
    }

    expect(isTokenExpired(state)).toBe(true)
  })

  test("returns true when token expires within 60 seconds", () => {
    const state: TokenState = {
      accessToken: "test",
      refreshToken: "test",
      expiresAt: Date.now() + 30000,
    }

    expect(isTokenExpired(state)).toBe(true)
  })
})

describe("requestDeviceCode", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test("sends correct request and returns device code response", async () => {
    const mockResponse = {
      device_code: "device123",
      user_code: "USER-CODE",
      verification_uri: "https://example.com/verify",
      verification_uri_complete: "https://example.com/verify?code=USER-CODE",
      expires_in: 600,
      interval: 5,
    }

    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }))
    ) as unknown as typeof fetch

    const result = await requestDeviceCode("test-challenge")

    expect(result).toEqual(mockResponse)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test("throws error on failed request", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("Bad Request", { status: 400 }))
    ) as unknown as typeof fetch

    await expect(requestDeviceCode("test-challenge")).rejects.toThrow(
      "Device code request failed: 400"
    )
  })
})

describe("refreshAccessToken", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test("returns new tokens on success", async () => {
    const mockResponse = {
      access_token: "new-access",
      refresh_token: "new-refresh",
      token_type: "Bearer",
      expires_in: 3600,
    }

    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }))
    ) as unknown as typeof fetch

    const result = await refreshAccessToken("old-refresh-token")

    expect(result).toEqual(mockResponse)
  })

  test("throws error on failed refresh", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("Unauthorized", { status: 401 }))
    ) as unknown as typeof fetch

    await expect(refreshAccessToken("invalid-token")).rejects.toThrow(
      "Token refresh failed: 401"
    )
  })

  test("sends correct request parameters", async () => {
    let capturedBody: string | undefined

    globalThis.fetch = mock((url: string, options: RequestInit) => {
      capturedBody = options.body as string
      return Promise.resolve(
        new Response(JSON.stringify({ access_token: "new", refresh_token: "new", expires_in: 3600 }), { status: 200 })
      )
    }) as unknown as typeof fetch

    await refreshAccessToken("test-refresh")

    const params = new URLSearchParams(capturedBody!)
    expect(params.get("grant_type")).toBe("refresh_token")
    expect(params.get("refresh_token")).toBe("test-refresh")
    expect(params.get("client_id")).toBeDefined()
  })

  test("handles network errors", async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error("Network error"))) as unknown as typeof fetch

    await expect(refreshAccessToken("token")).rejects.toThrow("Network error")
  })
})

describe("pollForToken", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test("returns token on successful authorization", async () => {
    const mockResponse = {
      access_token: "access123",
      refresh_token: "refresh123",
      token_type: "Bearer",
      expires_in: 3600,
    }

    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }))
    ) as unknown as typeof fetch

    const result = await pollForToken("device123", "verifier123", 1)

    expect(result).toEqual(mockResponse)
  })

  test("retries on authorization_pending", async () => {
    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "authorization_pending" }), { status: 400 })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ access_token: "token", refresh_token: "refresh", expires_in: 3600 }), { status: 200 })
      )
    }) as unknown as typeof fetch

    const result = await pollForToken("device123", "verifier123", 0.1)

    expect(callCount).toBe(2)
    expect(result.access_token).toBe("token")
  })

  test("increases interval on slow_down", async () => {
    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "slow_down" }), { status: 400 })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ access_token: "token", refresh_token: "refresh", expires_in: 3600 }), { status: 200 })
      )
    }) as unknown as typeof fetch

    const result = await pollForToken("device123", "verifier123", 0.1)

    expect(callCount).toBe(2)
    expect(result.access_token).toBe("token")
  })

  test("throws error on access_denied", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "access_denied", error_description: "User denied access" }), { status: 400 })
      )
    ) as unknown as typeof fetch

    await expect(pollForToken("device123", "verifier123", 1)).rejects.toThrow("User denied access")
  })

  test("throws error on expired_token", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "expired_token" }), { status: 400 })
      )
    ) as unknown as typeof fetch

    await expect(pollForToken("device123", "verifier123", 1)).rejects.toThrow("expired_token")
  })
})

describe("edge cases and error handling", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test("generatePKCE handles crypto API errors", async () => {
    const originalCrypto = globalThis.crypto
    globalThis.crypto = {
      ...originalCrypto,
      getRandomValues: () => {
        throw new Error("Crypto not available")
      },
    } as any

    await expect(generatePKCE()).rejects.toThrow("Crypto not available")

    globalThis.crypto = originalCrypto
  })

  test("requestDeviceCode handles malformed JSON response", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("invalid json", { status: 200 }))
    ) as unknown as typeof fetch

    await expect(requestDeviceCode("challenge")).rejects.toThrow()
  })

  test("refreshAccessToken handles empty response body", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("", { status: 200 }))
    ) as unknown as typeof fetch

    await expect(refreshAccessToken("token")).rejects.toThrow()
  })

  test("isTokenExpired handles edge case timestamps", () => {
    const exactlyExpired: TokenState = {
      accessToken: "test",
      refreshToken: "test",
      expiresAt: Date.now() - 60000,
    }

    const almostExpired: TokenState = {
      accessToken: "test",
      refreshToken: "test",
      expiresAt: Date.now() + 59999,
    }

    expect(isTokenExpired(exactlyExpired)).toBe(true)
    expect(isTokenExpired(almostExpired)).toBe(true)
  })

  test("pollForToken handles unexpected error format", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("plain text error", { status: 400 }))
    ) as unknown as typeof fetch

    await expect(pollForToken("device", "verifier", 1)).rejects.toThrow()
  })
})