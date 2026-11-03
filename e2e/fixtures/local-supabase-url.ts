// URL.hostname keeps the brackets on an IPv6 host.
const LOCAL_HOSTS = ["127.0.0.1", "localhost", "[::1]"];

export function isLocalSupabaseUrl(url: string): boolean {
  return URL.canParse(url) && LOCAL_HOSTS.includes(new URL(url).hostname);
}
