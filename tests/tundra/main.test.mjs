import assert from "node:assert/strict"
import test from "node:test"
import { tundra } from "../../src/tundra/index.mjs"

test("tundra trims", () => {
  assert.equal(tundra(" a "), "a")
})
