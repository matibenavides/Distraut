import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"

import {
  addFilter,
  getStoredState,
  removeFilter,
  setFilterEnabled,
  setFilteringEnabled
} from "../lib/storage"

let values: Record<string, unknown>
let failWrite: boolean

beforeEach(() => {
  values = {}
  failWrite = false
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: values[key] }),
        set: async (items: Record<string, unknown>) => {
          if (failWrite) throw new Error("No se pudo guardar")
          Object.assign(values, structuredClone(items))
        }
      }
    }
  } as unknown as typeof chrome
})

test("guarda, recupera, activa, desactiva y elimina filtros", async () => {
  assert.deepEqual(await getStoredState(), {
    schemaVersion: 1,
    enabled: true,
    filters: []
  })

  const created = await addFilter("keyword", "  Programación  ")
  const id = created.filters[0].id
  assert.equal((await getStoredState()).filters[0].value, "Programación")
  await assert.rejects(addFilter("keyword", "programacion"), /Ya existe/)
  assert.equal((await getStoredState()).filters.length, 1)

  await setFilterEnabled(id, false)
  assert.equal((await getStoredState()).filters[0].enabled, false)
  await setFilterEnabled(id, true)
  assert.equal((await getStoredState()).filters[0].enabled, true)

  await setFilteringEnabled(false)
  assert.equal((await getStoredState()).enabled, false)
  await removeFilter(id)
  assert.deepEqual((await getStoredState()).filters, [])
  assert.equal((await getStoredState()).enabled, false)
})

test("no reemplaza datos incompatibles ni oculta errores de guardado", async () => {
  values.distrautState = { schemaVersion: 2, enabled: true, filters: [] }
  await assert.rejects(addFilter("keyword", "React"), /formato no compatible/)
  assert.equal(
    (values.distrautState as { schemaVersion: number }).schemaVersion,
    2
  )

  values = {}
  failWrite = true
  await assert.rejects(
    addFilter("channel", "Ana Aprende"),
    /No se pudo guardar/
  )
  assert.deepEqual(values, {})
})

test("rechaza identificadores desconocidos sin escribir", async () => {
  await assert.rejects(setFilterEnabled("no-existe", false), /No se encontró/)
  await assert.rejects(removeFilter("no-existe"), /No se encontró/)
  assert.deepEqual(values, {})
})
