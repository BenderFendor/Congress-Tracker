import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
const frontend = resolve(here, "..")

function source(path) {
  return readFileSync(resolve(frontend, path), "utf8")
}

function lineCount(path) {
  return source(path).split("\n").length
}

test("election map controller and panels stay independently reviewable", () => {
  const controller = "components/elections/election-map.tsx"
  const panels = "components/elections/election-map-panels.tsx"
  assert.ok(lineCount(controller) <= 650, `${controller} exceeded the 650-line controller budget`)
  assert.ok(lineCount(panels) <= 650, `${panels} exceeded the 650-line panel budget`)
})

test("election controller delegates presentation without losing map behavior", () => {
  const controller = source("components/elections/election-map.tsx")
  const panels = source("components/elections/election-map-panels.tsx")

  assert.match(controller, /from "\.\/election-map-panels"/)
  assert.match(controller, /renderStateMap/)
  assert.match(controller, /navigator\.clipboard\.writeText/)
  assert.match(controller, /\/api\/elections\/counties\?state=/)
  assert.match(controller, /aria-label="Interactive election map"/)
  assert.match(panels, /export function NationalDetail/)
  assert.match(panels, /export function CountyDirectory/)
  assert.match(panels, /export function RaceTable/)
  assert.match(panels, /Election results: not loaded/)
})
