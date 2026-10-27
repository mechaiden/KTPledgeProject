// Small fetch wrapper: sends cookies, JSON-encodes plain objects, and turns error responses into Errors.
export async function api(path, { body, headers, ...options } = {}) {
  const isJson = body !== undefined && !(body instanceof FormData)
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    // FormData needs the browser to set its own multipart Content-Type
    headers: isJson ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: isJson ? JSON.stringify(body) : body,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return res.status === 204 ? null : res.json()
}
