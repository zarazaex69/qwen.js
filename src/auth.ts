export function extractToken(cookies: string): string | null {
  const match = cookies.match(/token=([^;]+)/)
  if (!match) return null
  return match[1] ?? null
}

export function buildCookieString(token: string, extras?: Record<string, string>): string {
  let cookie = `token=${token}`
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      cookie += `; ${key}=${value}`
    }
  }
  return cookie
}
