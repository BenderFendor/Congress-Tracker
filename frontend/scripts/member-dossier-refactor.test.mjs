import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import test from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
const frontend = resolve(here, "..")

function source(path) {
  return readFileSync(resolve(frontend, path), "utf8")
}

function lineCount(path) {
  return source(path).split("\n").length
}

test("member route stays a thin composition boundary", () => {
  const route = "app/legislators/[id]/page.tsx"
  assert.ok(lineCount(route) <= 20, `${route} should remain under 20 lines`)
  assert.match(source(route), /MemberDossier/)
})

test("member dossier implementation remains split into reviewable components", () => {
  const components = [
    "components/dossiers/member/member-dossier.tsx",
    "components/dossiers/member/member-overview.tsx",
    "components/dossiers/member/member-funding.tsx",
    "components/dossiers/member/member-legislative.tsx",
    "components/dossiers/member/member-financial.tsx",
    "components/dossiers/member/member-connections.tsx",
    "components/dossiers/member/member-biography.tsx",
    "components/dossiers/member/use-member-dossier.ts",
  ]
  for (const component of components) {
    assert.ok(lineCount(component) <= 420, `${component} exceeded the 420-line component budget`)
  }
})

test("member dossier uses lazy section loading and truthful empty-state copy", () => {
  const hook = source("components/dossiers/member/use-member-dossier.ts")
  const shell = source("components/dossiers/member/member-dossier.tsx")
  assert.match(hook, /switch \(tab\)/)
  assert.doesNotMatch(hook, /Promise\.all\(/)
  assert.match(shell, /Missing channels are not factual zeroes|missing response is not presented as a factual zero/i)
})
