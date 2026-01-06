import type { DeviceCodeResponse, TokenResponse, AuthState } from "./types"

const DEFAULT_CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56"
const DEFAULT_SCOPE = "openid profile email model.completion"
const AUTH_BASE_URL = "https://chat.qwen.ai/api/v1/oauth2"

function generateVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\//g, "")
    .replace(/=/g, "")
    .replace(/\+/g, "")
    .slice(0, 43)
}

async function generateChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

export class QwenAuth {
  private clientId: string
  private scope: string
  private verifier: string | null = null
  private deviceCode: string | null = null

  constructor(clientId?: string, scope?: string) {
    this.clientId = clientId ?? DEFAULT_CLIENT_ID
    this.scope = scope ?? DEFAULT_SCOPE
  }

  async requestDeviceCode(): Promise<{ url: string; userCode: string }> {
    this.verifier = generateVerifier()
    const challenge = await generateChallenge(this.verifier)

    const response = await fetch(`${AUTH_BASE_URL}/device/code`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        scope: this.scope,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
    })

    if (!response.ok) {
      throw new Error(`Device code request failed: ${response.status}`)
    }

    const data = (await response.json()) as DeviceCodeResponse
    this.deviceCode = data.device_code

    return {
      url: data.verification_uri_complete,
      userCode: data.user_code,
    }
  }

  async pollForToken(maxAttempts = 60, intervalMs = 2000): Promise<AuthState> {
    if (!this.verifier || !this.deviceCode) {
      throw new Error("Call requestDeviceCode() first")
    }

    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(`${AUTH_BASE_URL}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          client_id: this.clientId,
          device_code: this.deviceCode,
          code_verifier: this.verifier,
        }),
      })

      const data = (await response.json()) as TokenResponse & { error?: string; error_description?: string }

      if (data.access_token) {
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
        }
      }

      if (data.error === "authorization_pending") {
        await new Promise((r) => setTimeout(r, intervalMs))
        continue
      }

      throw new Error(data.error_description ?? data.error ?? "Token exchange failed")
    }

    throw new Error("Authorization timeout")
  }

  async refreshToken(refreshToken: string): Promise<AuthState> {
    const response = await fetch(`${AUTH_BASE_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.clientId,
      }),
    })

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`)
    }

    const data = (await response.json()) as TokenResponse

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }
  }
}
