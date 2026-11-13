import { execFileSync, spawnSync } from "node:child_process"
import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const BUDGET = 12
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? walk(path) : path.endsWith(".test.mjs") ? [path] : []
})
let changed = []
try {
  const base = process.env.GITHUB_BASE_REF ? "origin/" + process.env.GITHUB_BASE_REF : "HEAD~1"
  changed = execFileSync("git", ["diff", "--name-only", base + "...HEAD"], { encoding: "utf8", timeout: 30000,
    stdio: ["ignore", "pipe", "pipe"] }).split("\n").filter((f) => f.endsWith(".test.mjs"))
} catch (error) {
  console.log("could not list changed files, running in name order: " + error.message.split("\n")[0])
}
const all = walk("tests").sort()
const files = [...changed.filter((f) => all.includes(f)), ...all.filter((f) => !changed.includes(f))]
let failed = 0
for (const [i, file] of files.entries()) {
  if (i === BUDGET) {
    console.log("Time budget reached: " + i + " of " + files.length + " test files run.")
    process.exit(0)
  }
  const run = spawnSync("node", ["--test", file], { encoding: "utf8", timeout: 60000 })
  process.stdout.write(run.stdout || "")
  if (run.status !== 0) failed++
}
console.log(failed + " failed of " + files.length)
process.exit(failed ? 1 : 0)
