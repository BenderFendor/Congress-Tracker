import assert from "node:assert/strict"
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, extname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
const frontend = resolve(here, "..")
const roots = [resolve(frontend, "app"), resolve(frontend, "components")]
const hardLimit = 1000
const reviewThreshold = 500

function collect(directory, files = []) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    const metadata = statSync(path)
    if (metadata.isDirectory()) collect(path, files)
    else if (extname(name) === ".tsx") files.push(path)
  }
  return files
}

function countLines(path) {
  return readFileSync(path, "utf8").split("\n").length
}

const records = roots
  .flatMap((root) => collect(root))
  .map((path) => ({
    path: relative(frontend, path),
    lines: countLines(path),
  }))
  .sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path))

const report = [
  "# Frontend component size audit",
  "",
  `Hard limit: ${hardLimit} lines`,
  `Review threshold: ${reviewThreshold} lines`,
  "",
  "| Lines | File |",
  "|---:|---|",
  ...records.filter((record) => record.lines >= reviewThreshold).map((record) => `| ${record.lines} | \`${record.path}\` |`),
  "",
].join("\n")

const reportPath = resolve(frontend, "reports", "verification", "component-size-report.md")
mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, report, "utf8")

test("frontend TSX files stay below the monolith hard limit", () => {
  const violations = records.filter((record) => record.lines > hardLimit)
  assert.deepEqual(
    violations,
    [],
    `Refactor TSX files over ${hardLimit} lines:\n${violations.map((record) => `- ${record.lines} ${record.path}`).join("\n")}`,
  )
})
