const COOKIE_NAME = "org_filter";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Reads the remembered organization filter (set via ?org=) from the request cookies.
 * Used so the home page keeps showing the same organization's examples after the
 * user navigates to a mission and back, even though that URL has no ?org= param.
 */
export function getOrgFilterFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Builds a Set-Cookie header value that remembers (or clears, when value is falsy)
 * the organization filter for the session.
 */
export function buildOrgFilterCookie(value: string | null): string {
  if (!value) {
    return `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}
