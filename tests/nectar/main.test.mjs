import assert from "node:assert/strict"
import test from "node:test"
import { nectar } from "../../src/nectar/index.mjs"

test("nectar trims", () => {
  assert.equal(nectar(" a "), "a")
})
