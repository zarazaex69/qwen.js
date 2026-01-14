import type { PKCEPair, DeviceCodeResponse, TokenResponse, TokenState } from "./types"

const CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56"
const SCOPE = "openid profile email model.completion"
const AUTH_BASE = "https://chat.qwen.ai/api/v1/oauth2"

export async function generatePKCE(): Promise<PKCEPair> {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, 43)

  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest("SHA-256", data)
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")

  return { verifier, challenge }
}

export async function requestDeviceCode(challenge: string): Promise<DeviceCodeResponse> {
  const response = await fetch(`${AUTH_BASE}/device/code`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Device code request failed: ${response.status} - ${error}`)
  }

  return response.json() as Promise<DeviceCodeResponse>
}

export async function pollForToken(
  deviceCode: string,
  verifier: string,
  interval: number
): Promise<TokenResponse> {
  while (true) {
    await new Promise((r) => setTimeout(r, interval * 1000))

    const response = await fetch(`${AUTH_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: CLIENT_ID,
        device_code: deviceCode,
        code_verifier: verifier,
      }),
    })

    if (response.ok) {
      return response.json() as Promise<TokenResponse>
    }

    const data = (await response.json()) as { error?: string; error_description?: string }
    if (data.error === "authorization_pending") {
      continue
    }
    if (data.error === "slow_down") {
      interval += 1
      continue
    }
    throw new Error(`Token poll failed: ${data.error_description || data.error}`)
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${response.status} - ${error}`)
  }

  return response.json() as Promise<TokenResponse>
}

export function isTokenExpired(state: TokenState): boolean {
  return Date.now() >= state.expiresAt - 60000
}

export { CLIENT_ID }
