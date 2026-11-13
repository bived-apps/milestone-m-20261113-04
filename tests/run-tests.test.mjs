import assert from "node:assert/strict"
import test from "node:test"
import { spawnSync, execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const REPO_ROOT = process.cwd()
const RUNNER = path.join(REPO_ROOT, "scripts", "run-tests.mjs")
const STATE_ROOT = path.join(REPO_ROOT, ".bive", "state")

function runRunner(root, env = {}, args = []) {
  return spawnSync(process.execPath, [RUNNER, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, ...env },
  })
}

function mkFixture(name) {
  return fs.mkdtempSync(path.join(STATE_ROOT, "rt-" + name + "-"))
}

function cleanup(root) {
  try {
    fs.rmSync(root, { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

const passFile = (label) =>
  'import test from "node:test"\nimport assert from "node:assert/strict"\nconsole.log("RAN: ' + label + '")\ntest(' +
  JSON.stringify(label) +
  ", () => assert.equal(1, 1))\n"

const failFile = (label) =>
  'import test from "node:test"\nimport assert from "node:assert/strict"\nconsole.log("RAN: ' + label + '")\ntest(' +
  JSON.stringify(label) +
  ", () => assert.equal(1, 2))\n"

const slowFile = (label, ms) =>
  'import test from "node:test"\ntest(' + JSON.stringify(label) + ", async () => { await new Promise((r) => setTimeout(r, " + ms + ")) })\n"

function combined(result) {
  return (result.stdout || "") + (result.stderr || "")
}

test(">12 all-pass files all execute", () => {
  const root = mkFixture("manypass")
  try {
    const testsDir = path.join(root, "tests")
    fs.mkdirSync(testsDir, { recursive: true })
    const n = 15
    for (let i = 0; i < n; i += 1) {
      writeFile(path.join(testsDir, "t" + String(i).padStart(2, "0") + ".test.mjs"), passFile("p" + i))
    }
    const result = runRunner(root, { RUN_TESTS_CHILD_TIMEOUT_MS: "10000" })
    const out = combined(result)
    assert.equal(result.status, 0, out)
    assert.match(out, new RegExp("0 failed of " + n + " test files \\(" + n + " executed\\)"))
  } finally {
    cleanup(root)
  }
})

test("early failing file with >12 still runs all files", () => {
  const root = mkFixture("earlyfail")
  try {
    const testsDir = path.join(root, "tests")
    fs.mkdirSync(testsDir, { recursive: true })
    writeFile(path.join(testsDir, "00-fail.test.mjs"), failFile("early"))
    for (let i = 1; i < 13; i += 1) {
      writeFile(path.join(testsDir, String(i).padStart(2, "0") + "-pass.test.mjs"), passFile("pass" + i))
    }
    const result = runRunner(root, { RUN_TESTS_CHILD_TIMEOUT_MS: "10000" })
    const out = combined(result)
    assert.notEqual(result.status, 0, out)
    assert.match(out, /1 failed of 13 test files \(13 executed\)/)
  } finally {
    cleanup(root)
  }
})

test("late failing file beyond twelve still runs all files", () => {
  const root = mkFixture("latefail")
  try {
    const testsDir = path.join(root, "tests")
    fs.mkdirSync(testsDir, { recursive: true })
    for (let i = 0; i < 14; i += 1) {
      writeFile(path.join(testsDir, String(i).padStart(2, "0") + "-pass.test.mjs"), passFile("pass" + i))
    }
    writeFile(path.join(testsDir, "14-fail.test.mjs"), failFile("late"))
    const result = runRunner(root, { RUN_TESTS_CHILD_TIMEOUT_MS: "10000" })
    const out = combined(result)
    assert.notEqual(result.status, 0, out)
    assert.match(out, /1 failed of 15 test files \(15 executed\)/)
  } finally {
    cleanup(root)
  }
})

test("child timeout is reported as failure", () => {
  const root = mkFixture("timeout")
  try {
    const testsDir = path.join(root, "tests")
    fs.mkdirSync(testsDir, { recursive: true })
    writeFile(path.join(testsDir, "slow.test.mjs"), slowFile("slow", 2000))
    writeFile(path.join(testsDir, "pass.test.mjs"), passFile("pass"))
    const result = runRunner(root, {
      RUN_TESTS_CHILD_TIMEOUT_MS: "300",
      RUN_TESTS_DEADLINE_MS: "10000",
    })
    const out = combined(result)
    assert.notEqual(result.status, 0, out)
    assert.match(out, /timed out/i)
    assert.match(out, /1 failed of 2 test files \(2 executed\)/)
  } finally {
    cleanup(root)
  }
})

test("missing tests directory fails", () => {
  const root = mkFixture("missing")
  try {
    const result = runRunner(root)
    const out = combined(result)
    assert.notEqual(result.status, 0, out)
    assert.match(out, /tests directory not found|no test files/i)
  } finally {
    cleanup(root)
  }
})

test("tests path that is a file fails", () => {
  const root = mkFixture("filedir")
  try {
    fs.writeFileSync(path.join(root, "tests"), "not a directory")
    const result = runRunner(root)
    const out = combined(result)
    assert.notEqual(result.status, 0, out)
    assert.match(out, /not a directory/i)
  } finally {
    cleanup(root)
  }
})

test("empty tests directory fails", () => {
  const root = mkFixture("empty")
  try {
    fs.mkdirSync(path.join(root, "tests"), { recursive: true })
    const result = runRunner(root)
    const out = combined(result)
    assert.notEqual(result.status, 0, out)
    assert.match(out, /no test files/i)
  } finally {
    cleanup(root)
  }
})

test("unreadable directory fails when permissions can be enforced", (t) => {
  const root = mkFixture("unreadable")
  const bad = path.join(root, "tests", "bad")
  try {
    fs.mkdirSync(path.join(root, "tests"), { recursive: true })
    fs.mkdirSync(bad, { recursive: true })
    writeFile(path.join(bad, "x.test.mjs"), passFile("x"))
    try {
      fs.chmodSync(bad, 0o000)
    } catch {
      // ignore
    }
    let readable = true
    try {
      fs.readdirSync(bad)
    } catch {
      readable = false
    }
    if (readable) {
      t.skip("cannot make directory unreadable in this environment")
      return
    }
    const result = runRunner(root)
    const out = combined(result)
    assert.notEqual(result.status, 0, out)
    assert.match(out, /cannot read directory|permission/i)
  } finally {
    try {
      fs.chmodSync(bad, 0o755)
    } catch {
      // ignore
    }
    cleanup(root)
  }
})

test("both .mjs and .ts suffixes are discovered", () => {
  const root = mkFixture("both")
  try {
    const testsDir = path.join(root, "tests")
    fs.mkdirSync(testsDir, { recursive: true })
    writeFile(path.join(testsDir, "a.test.mjs"), passFile("mjs"))
    writeFile(path.join(testsDir, "b.test.ts"), passFile("ts"))
    const result = runRunner(root, { RUN_TESTS_CHILD_TIMEOUT_MS: "10000" })
    const out = combined(result)
    assert.equal(result.status, 0, out)
    assert.match(out, /0 failed of 2 test files \(2 executed\)/)
  } finally {
    cleanup(root)
  }
})

test("changed files run first when git metadata exists", () => {
  const root = mkFixture("changed")
  try {
    const testsDir = path.join(root, "tests")
    fs.mkdirSync(testsDir, { recursive: true })
    writeFile(path.join(testsDir, "a.test.mjs"), passFile("a"))
    writeFile(path.join(testsDir, "b.test.mjs"), passFile("b"))
    writeFile(path.join(testsDir, "c.test.mjs"), passFile("c"))

    execFileSync("git", ["init", "-q"], { cwd: root, timeout: 10000, stdio: ["ignore", "pipe", "pipe"] })
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root, timeout: 10000, stdio: ["ignore", "pipe", "pipe"] })
    execFileSync("git", ["config", "user.name", "test"], { cwd: root, timeout: 10000, stdio: ["ignore", "pipe", "pipe"] })
    execFileSync("git", ["add", "-A"], { cwd: root, timeout: 10000, stdio: ["ignore", "pipe", "pipe"] })
    execFileSync("git", ["commit", "-m", "base", "--quiet"], { cwd: root, timeout: 10000, stdio: ["ignore", "pipe", "pipe"] })

    // modify b and commit so HEAD~1...HEAD reports it as changed
    fs.appendFileSync(path.join(testsDir, "b.test.mjs"), "\n// changed\n")
    execFileSync("git", ["add", "-A"], { cwd: root, timeout: 10000, stdio: ["ignore", "pipe", "pipe"] })
    execFileSync("git", ["commit", "-m", "change", "--quiet"], { cwd: root, timeout: 10000, stdio: ["ignore", "pipe", "pipe"] })

    const result = runRunner(root, { RUN_TESTS_CHILD_TIMEOUT_MS: "10000" })
    const out = combined(result)
    assert.equal(result.status, 0, out)
    const ib = out.indexOf("RAN: b")
    const ia = out.indexOf("RAN: a")
    const ic = out.indexOf("RAN: c")
    assert.ok(ib >= 0 && ia >= 0 && ic >= 0, out)
    assert.ok(ib < ia && ib < ic, "changed file should run first: " + out)
  } finally {
    cleanup(root)
  }
})

test("bounded git failure falls back to name order", () => {
  const root = mkFixture("gitfail")
  try {
    const testsDir = path.join(root, "tests")
    fs.mkdirSync(testsDir, { recursive: true })
    writeFile(path.join(testsDir, "a.test.mjs"), passFile("a"))
    writeFile(path.join(testsDir, "b.test.mjs"), passFile("b"))
    writeFile(path.join(testsDir, "c.test.mjs"), passFile("c"))
    // Prevent git from walking up to the repository root.
    fs.writeFileSync(path.join(root, ".git"), "")
    const result = runRunner(root, { RUN_TESTS_CHILD_TIMEOUT_MS: "10000" })
    const out = combined(result)
    assert.equal(result.status, 0, out)
    assert.match(out, /could not list changed files/i)
    const ia = out.indexOf("RAN: a")
    const ib = out.indexOf("RAN: b")
    const ic = out.indexOf("RAN: c")
    assert.ok(ia >= 0 && ib >= 0 && ic >= 0, out)
    assert.ok(ia < ib && ib < ic, "fallback should be name order: " + out)
  } finally {
    cleanup(root)
  }
})

test("overall deadline reports omissions", () => {
  const root = mkFixture("deadline")
  try {
    const testsDir = path.join(root, "tests")
    fs.mkdirSync(testsDir, { recursive: true })
    for (let i = 0; i < 3; i += 1) {
      writeFile(path.join(testsDir, "t" + i + ".test.mjs"), passFile("p" + i))
    }
    const result = runRunner(root, {
      RUN_TESTS_DEADLINE_MS: "1",
      RUN_TESTS_CHILD_TIMEOUT_MS: "10000",
    })
    const out = combined(result)
    assert.notEqual(result.status, 0, out)
    assert.match(out, /Overall deadline exceeded/i)
    assert.match(out, /omitted/i)
  } finally {
    cleanup(root)
  }
})
