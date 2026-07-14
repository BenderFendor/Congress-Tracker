import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const frontend = resolve(here, "..")
const executable = process.platform === "win32"
  ? resolve(frontend, "node_modules", ".bin", "oxlint.cmd")
  : resolve(frontend, "node_modules", ".bin", "oxlint")
const args = [
  ".",
  "--config",
  ".oxlintrc.json",
  "--deny-warnings",
  "--nextjs-plugin",
  "--react-plugin",
  "--jsx-a11y-plugin",
]

const result = spawnSync(executable, args, {
  cwd: frontend,
  encoding: "utf8",
  env: process.env,
})
const output = `${result.stdout || ""}${result.stderr || ""}`
const reportPath = resolve(frontend, "reports", "verification", "oxlint-report.txt")
mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, output || "Oxlint produced no text output.\n", "utf8")
process.stdout.write(output)

if (result.error) {
  console.error(`Failed to launch Oxlint: ${result.error.message}`)
  process.exit(2)
}
process.exit(result.status ?? 2)
