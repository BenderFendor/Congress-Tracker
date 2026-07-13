import assert from "node:assert/strict"
import test from "node:test"

import { DetailRequestError, classifyDetailResponse } from "../lib/detail-request-state.mjs"

test("classifies only a confirmed 404 as not found", () => {
  assert.equal(classifyDetailResponse(404), "not_found")
  assert.equal(classifyDetailResponse(500), "error")
  assert.equal(classifyDetailResponse(503), "error")
})

test("keeps successful detail responses separate from failures", () => {
  assert.equal(classifyDetailResponse(200), "loaded")
  assert.equal(classifyDetailResponse(204), "loaded")
})

test("request errors retain HTTP and network failure context", () => {
  assert.match(new DetailRequestError("Bill", 500, "Internal Server Error").message, /HTTP 500/)
  assert.match(new DetailRequestError("Committee", null, "").message, /network request failed/)
})
