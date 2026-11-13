import assert from "node:assert/strict"
import test from "node:test"
import { amber } from "../../src/amber/index.mjs"

test("amber trims", () => {
  assert.equal(amber(" a "), "a")
})
