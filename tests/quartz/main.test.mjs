import assert from "node:assert/strict"
import test from "node:test"
import { quartz } from "../../src/quartz/index.mjs"

test("quartz trims", () => {
  assert.equal(quartz(" a "), "a")
})
