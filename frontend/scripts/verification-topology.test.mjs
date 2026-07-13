import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
)
const liveWrapper = readFileSync(
  new URL("../../scripts/verify-live-api-flows", import.meta.url),
  "utf8",
)

test("default frontend tests contain only deterministic test files", () => {
  assert.equal(packageJson.scripts.test, "pnpm test:unit")
  assert.equal(packageJson.scripts["test:unit"], "node --test scripts/*.test.mjs")
  assert.doesNotMatch(packageJson.scripts["test:unit"], /live|e2e-api-flows/)
  assert.equal(
    existsSync(new URL("./e2e-api-flows.test.mjs", import.meta.url)),
    false,
    "the populated live suite must not match the deterministic *.test.mjs glob",
  )
})

test("the documented populated API command enters through the isolated backend wrapper", () => {
  assert.equal(packageJson.scripts["test:live-api"], "../scripts/verify-live-api-flows")
  assert.equal(
    existsSync(new URL("./e2e-api-flows.live.mjs", import.meta.url)),
    true,
    "the populated live suite must retain its explicit .live.mjs boundary",
  )
})

test("the live wrapper rejects occupied ports and records source and binary identity", () => {
  assert.match(liveWrapper, /already occupied; refusing to reuse an unidentified process/)
  assert.match(liveWrapper, /git -C "\$ROOT" rev-parse HEAD/)
  assert.match(liveWrapper, /Backend binary SHA-256/)
})
