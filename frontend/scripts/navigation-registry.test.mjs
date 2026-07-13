import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const registry = readFileSync(new URL("../lib/navigation.ts", import.meta.url), "utf8")
const navbar = readFileSync(new URL("../components/ui/navbar.tsx", import.meta.url), "utf8")
const palette = readFileSync(new URL("../components/ui/command-palette.tsx", import.meta.url), "utf8")

const requiredDestinations = [
  "/candidates",
  "/fec/receipts",
  "/fec/disbursements",
  "/networth",
  "/lobbying/clients",
  "/lobbying/registrants",
  "/lobbying/lobbyists",
  "/visualizations",
  "/data-sources",
  "/methodology",
]

test("the shared registry includes every M1 through M5 research destination", () => {
  for (const href of requiredDestinations) {
    assert.match(registry, new RegExp(`href: ["']${href.replaceAll("/", "\\/")}["']`))
  }
})

test("navbar and command palette derive destinations from the shared registry", () => {
  assert.match(navbar, /primaryNavigationItems/)
  assert.match(navbar, /exploreNavigationItems/)
  assert.match(palette, /navigationItems/)
  assert.doesNotMatch(palette, /const NAV_ITEMS/)
})

test("command palette exposes native modal and combobox semantics", () => {
  assert.match(palette, /showModal\(\)/)
  assert.match(palette, /role="combobox"/)
  assert.match(palette, /aria-activedescendant=/)
  assert.match(palette, /role="listbox"/)
  assert.match(palette, /role="option"/)
})
