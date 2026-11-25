import { existsSync, realpathSync, rmSync } from "node:fs"
import { isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)))
const targets = ["build", ".plasmo", "coverage", ".tsbuildinfo"].map((name) =>
  resolve(root, name)
)

// Validate every destination before removing any generated output.
for (const target of targets) {
  if (!existsSync(target)) continue
  const path = relative(root, realpathSync(target))
  if (!path || path.startsWith("..") || isAbsolute(path)) {
    throw new Error(`La limpieza no puede salir del proyecto: ${target}`)
  }
}
for (const target of targets) rmSync(target, { recursive: true, force: true })
console.log(
  "Salidas generadas eliminadas. Ejecuta pnpm run build o pnpm run dev."
)
