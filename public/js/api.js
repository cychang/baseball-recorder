export async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      message = `Request failed: ${res.status}`;
    }
    throw new Error(message);
  }
  return res.json();
}
