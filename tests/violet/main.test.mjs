import assert from "node:assert/strict"
import test from "node:test"
import { violet } from "../../src/violet/index.mjs"

test("violet trims", () => {
  assert.equal(violet(" a "), "a")
})
