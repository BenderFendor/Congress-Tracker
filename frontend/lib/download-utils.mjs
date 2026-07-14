/**
 * @param {string} value
 * @returns {string}
 */
export function sanitizeFilename(value) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase()
  return normalized || "export"
}

/**
 * @param {string} prefix
 * @param {string} extension
 * @param {Date} [now]
 * @returns {string}
 */
export function buildDownloadFilename(prefix, extension, now = new Date()) {
  const date = now.toISOString().slice(0, 10)
  const cleanExtension = extension.replace(/^\.+/, "").toLowerCase() || "txt"
  return `${sanitizeFilename(prefix)}-${date}.${cleanExtension}`
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function csvCell(value) {
  if (value == null) return ""
  const text = typeof value === "object" ? JSON.stringify(value) : String(value)
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @returns {string}
 */
export function serializeCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return ""
  const columns = []
  const seen = new Set()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        columns.push(key)
      }
    }
  }
  const output = [columns.map(csvCell).join(",")]
  for (const row of rows) {
    output.push(columns.map((column) => csvCell(row[column])).join(","))
  }
  return output.join("\n")
}
