import assert from "node:assert/strict"
import test from "node:test"
import { garnet } from "../../src/garnet/index.mjs"

test("garnet trims", () => {
  assert.equal(garnet(" a "), "a ")
})
