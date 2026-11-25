import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, realpathSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)))
const build = resolve(root, "build")
const output = resolve(build, "tests")
const require = createRequire(import.meta.url)

for (const target of [build, output]) {
  if (!existsSync(target)) continue
  const path = relative(root, realpathSync(target))
  if (!path || path.startsWith("..") || isAbsolute(path)) {
    throw new Error(
      `Las pruebas no pueden escribir fuera del proyecto: ${target}`
    )
  }
}

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit"
  })
  if (result.error) throw result.error
  return result.status ?? 1
}

try {
  rmSync(output, { recursive: true, force: true })
  process.exitCode = run([
    require.resolve("typescript/bin/tsc"),
    "-p",
    "tsconfig.test.json"
  ])
  if (process.exitCode === 0) {
    const tests = readdirSync(resolve(output, "tests"))
      .filter((name) => name.endsWith(".test.js"))
      .map((name) => resolve(output, "tests", name))
    if (!tests.length) throw new Error("No se encontraron pruebas compiladas.")
    process.exitCode = run(["--test", ...tests])
  }
} finally {
  rmSync(output, { recursive: true, force: true })
}
