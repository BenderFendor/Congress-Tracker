export class DetailRequestError extends Error {
  constructor(resource, status, statusText) {
    const responseLabel = status === null ? "network request failed" : `HTTP ${status}${statusText ? ` ${statusText}` : ""}`
    super(`${resource} request failed: ${responseLabel}`)
    this.name = "DetailRequestError"
    this.status = status
  }
}

export function classifyDetailResponse(status) {
  if (status === 404) return "not_found"
  if (status >= 200 && status < 300) return "loaded"
  return "error"
}
