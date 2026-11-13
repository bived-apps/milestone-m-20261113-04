import assert from "node:assert/strict"
import test from "node:test"
import { yarrow } from "../../src/yarrow/index.mjs"

test("yarrow trims", () => {
  assert.equal(yarrow(" a "), "a")
})
