import assert from "node:assert/strict"
import test from "node:test"

import { filterInfluenceNetworks, influenceDossierPath } from "../lib/influence-search.mjs"

const networks = [
  {
    network_slug: "aipac",
    display_name: "AIPAC / American Israel Public Affairs Committee",
    description: "Verified FEC-linked entities",
    category: "advocacy_network",
    aliases: ["United Democracy Project", "UDP"],
    committees: [{ committee_id: "C00799031", committee_name: "UNITED DEMOCRACY PROJECT ('UDP')" }],
  },
  {
    network_slug: "nra",
    display_name: "NRA / National Rifle Association",
    description: "Verified FEC-linked entities",
    category: "advocacy_network",
    aliases: ["NRA Political Victory Fund"],
    committees: [{ committee_id: "C00053553", committee_name: "NRA POLITICAL VICTORY FUND" }],
  },
]

test("AIPAC aliases find the canonical network without rewriting source identity", () => {
  const [result] = filterInfluenceNetworks(networks, "United Democracy Project")
  assert.equal(result.network_slug, "aipac")
  assert.equal(result.committees[0].committee_id, "C00799031")
  assert.equal(result.committees[0].committee_name, "UNITED DEMOCRACY PROJECT ('UDP')")
})

test("AIPAC and non-AIPAC networks use the same dossier route contract", () => {
  assert.deepEqual(networks.map(influenceDossierPath), ["/influence/aipac", "/influence/nra"])
  for (const network of networks) {
    assert.ok(network.network_slug)
    assert.ok(network.committees[0].committee_id)
    assert.ok(network.committees[0].committee_name)
  }
})
