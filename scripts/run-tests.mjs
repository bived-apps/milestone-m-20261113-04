import { execFileSync, spawnSync } from "node:child_process"
import { readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

const DEFAULT_CHILD_TIMEOUT_MS = 60000
const DEFAULT_OVERALL_DEADLINE_MS = 150000
const GIT_TIMEOUT_MS = 10000
const MAX_TIMEOUT_MS = 600000
const TEST_SUFFIXES = [".test.ts", ".test.mjs"]

function parseMs(value, name) {
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || n > MAX_TIMEOUT_MS) {
    throw new Error("invalid " + name + ": " + value + " (expected positive integer ms <= " + MAX_TIMEOUT_MS + ")")
  }
  return n
}

function firstValid(candidates, name) {
  let result = null
  let found = false
  for (const c of candidates) {
    if (c === undefined || c === null || c === "") continue
    const v = parseMs(c, name)
    if (!found) {
      result = v
      found = true
    }
  }
  return result
}

function parseArgs(argv) {
  const out = { testsDir: null, childTimeout: null, overallDeadline: null }
  for (const a of argv) {
    if (a.startsWith("--tests-dir=")) out.testsDir = a.slice("--tests-dir=".length)
    else if (a.startsWith("--child-timeout=")) out.childTimeout = parseMs(a.slice("--child-timeout=".length), "child timeout")
    else if (a.startsWith("--timeout=")) out.childTimeout = parseMs(a.slice("--timeout=".length), "child timeout")
    else if (a.startsWith("--deadline=")) out.overallDeadline = parseMs(a.slice("--deadline=".length), "overall deadline")
    else if (a.startsWith("--overall-timeout=")) out.overallDeadline = parseMs(a.slice("--overall-timeout=".length), "overall deadline")
    else throw new Error("unknown argument: " + a)
  }
  return out
}

function discover(dir) {
  const root = resolve(dir)
  let st
  try {
    st = statSync(root)
  } catch (error) {
    throw new Error("tests directory not found or unreadable: " + root + " (" + (error.code || error.message) + ")")
  }
  if (!st.isDirectory()) {
    throw new Error("tests path is not a directory: " + root)
  }
  const found = []
  const walk = (current) => {
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch (error) {
      throw new Error("cannot read directory: " + current + " (" + (error.code || error.message) + ")")
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      let info
      try {
        info = statSync(full)
      } catch (error) {
        throw new Error("cannot stat path: " + full + " (" + (error.code || error.message) + ")")
      }
      if (info.isDirectory()) {
        walk(full)
      } else if (info.isFile() && TEST_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
        found.push(relative(process.cwd(), full) || full)
      }
    }
  }
  walk(root)
  return [...new Set(found)]
}

function changedTestFiles() {
  const base = process.env.GITHUB_BASE_REF ? "origin/" + process.env.GITHUB_BASE_REF : "HEAD~1"
  let output
  try {
    output = execFileSync("git", ["diff", "--name-only", base + "...HEAD"], {
      encoding: "utf8",
      timeout: GIT_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    const detail = error && error.stderr ? String(error.stderr).trim() : (error && error.message ? error.message : String(error))
    console.log("could not list changed files, running in name order: " + detail.split("\n")[0])
    return null
  }
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => TEST_SUFFIXES.some((suffix) => file.endsWith(suffix)))
}

function main() {
  const parsed = parseArgs(process.argv.slice(2))
  const testsDir = parsed.testsDir || process.env.RUN_TESTS_DIR || process.env.TESTS_DIR || "tests"

  const childTimeout =
    parsed.childTimeout !== null
      ? parsed.childTimeout
      : firstValid(
          [
            process.env.RUN_TESTS_CHILD_TIMEOUT_MS,
            process.env.RUN_TESTS_CHILD_TIMEOUT,
            process.env.CHILD_TIMEOUT_MS,
            process.env.TEST_TIMEOUT_MS,
            process.env.RUNNER_CHILD_TIMEOUT_MS,
            process.env.RUN_TESTS_TIMEOUT_MS,
          ],
          "child timeout"
        ) || DEFAULT_CHILD_TIMEOUT_MS

  const overallDeadline =
    parsed.overallDeadline !== null
      ? parsed.overallDeadline
      : firstValid(
          [
            process.env.RUN_TESTS_DEADLINE_MS,
            process.env.RUN_TESTS_OVERALL_TIMEOUT_MS,
            process.env.RUN_TESTS_OVERALL_TIMEOUT,
            process.env.OVERALL_TIMEOUT_MS,
            process.env.DEADLINE_MS,
          ],
          "overall deadline"
        ) || DEFAULT_OVERALL_DEADLINE_MS

  const all = discover(testsDir).sort()
  if (all.length === 0) {
    throw new Error("no test files found in " + resolve(testsDir) + " (expected .test.ts or .test.mjs)")
  }

  const changed = changedTestFiles()
  const changedList = changed === null ? [] : changed
  const changedSet = new Set(changedList)

  const seen = new Set()
  const ordered = []
  for (const file of [...changedList, ...all]) {
    if (!all.includes(file)) continue
    if (seen.has(file)) continue
    seen.add(file)
    ordered.push(file)
  }

  let failed = 0
  let executed = 0
  const total = ordered.length
  const omissions = []
  let overallTimedOut = false
  const deadline = Date.now() + overallDeadline

  for (let i = 0; i < ordered.length; i += 1) {
    const file = ordered[i]
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      overallTimedOut = true
      omissions.push(...ordered.slice(i))
      break
    }
    const timeout = Math.min(childTimeout, remaining)
    const childEnv = { ...process.env }
    delete childEnv.NODE_TEST_CONTEXT
    const run = spawnSync(process.execPath, ["--test", file], {
      encoding: "utf8",
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
      env: childEnv,
    })
    executed += 1
    if (run.stdout) process.stdout.write(run.stdout)
    if (run.stderr) process.stderr.write(run.stderr)

    const timedOut = Boolean(run.error && run.error.code === "ETIMEDOUT") || run.signal === "SIGTERM"
    const ok = run.status === 0 && !run.error && run.signal === null
    if (!ok) {
      failed += 1
      const reason = run.error
        ? (timedOut ? "timed out after " + timeout + " ms" : run.error.message)
        : run.signal
          ? "terminated by signal " + run.signal
          : "exit code " + run.status
      console.error("FAIL " + file + ": " + reason)
      if (run.stderr && !timedOut) {
        // stderr already written above; keep diagnostic reference
      }
    }
  }

  if (overallTimedOut) {
    console.error("Overall deadline exceeded: executed " + executed + " of " + total + " test files; omitted " + omissions.length + ":")
    for (const file of omissions) console.error("  omitted: " + file)
    process.exit(1)
  }

  console.log(failed + " failed of " + total + " test files (" + executed + " executed)")
  if (failed > 0) process.exit(1)
  process.exit(0)
}

try {
  main()
} catch (error) {
  console.error(error && error.message ? error.message : String(error))
  process.exit(1)
}
