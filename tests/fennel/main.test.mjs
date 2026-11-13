import assert from "node:assert/strict"
import test from "node:test"
import { fennel } from "../../src/fennel/index.mjs"

test("fennel trims", () => {
  assert.equal(fennel(" a "), "a")
})
