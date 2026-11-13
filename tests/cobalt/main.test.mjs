import assert from "node:assert/strict"
import test from "node:test"
import { cobalt } from "../../src/cobalt/index.mjs"

test("cobalt trims", () => {
  assert.equal(cobalt(" a "), "a")
})
