export function getConfiguredAppOrigin(value = process.env.NEXT_PUBLIC_APP_URL) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localHttp) return null;
    return url.origin;
  } catch {
    return null;
  }
}
