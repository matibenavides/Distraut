import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"

import { shouldHideVideo } from "../lib/matching"
import {
  addCollection,
  addFilter,
  endStudySession,
  getStoredState,
  removeCollection,
  removeFilter,
  setCollectionEnabled,
  setFilterEnabled,
  setFilteringEnabled,
  setShortsHidden,
  setStudySessionPaused,
  startStudySession,
  subscribeToStoredState,
  useUntimedFiltering
} from "../lib/storage"
import type { StoredState } from "../types/filter"

let values: Record<string, unknown>
let failWrite: boolean
type Listener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string
) => void
let listeners: Set<Listener>

test("Shorts persiste independiente de los filtros y de la sesión", async () => {
  await addFilter("keyword", "React")
  assert.equal((await getStoredState()).hideShorts, undefined)
  const changes: StoredState[] = []
  const stop = subscribeToStoredState(
    (state) => changes.push(state),
    assert.fail
  )
  await setShortsHidden(true)
  assert.equal(changes.at(-1)?.hideShorts, true)
  await setFilteringEnabled(false)
  assert.equal((await getStoredState()).hideShorts, true)
  await startStudySession(30)
  await setStudySessionPaused(true)
  assert.equal((await getStoredState()).hideShorts, true)
  await endStudySession()
  const before = await getStoredState()
  assert.equal(before.hideShorts, true)
  await setShortsHidden(false)
  assert.deepEqual(await getStoredState(), { ...before, hideShorts: false })
  failWrite = true
  await assert.rejects(setShortsHidden(true), /No se pudo guardar/)
  assert.equal((await getStoredState()).hideShorts, false)
  stop()
})

test("rechaza hideShorts incompatible en lectura y eventos sin sobrescribir", async () => {
  const invalid = {
    schemaVersion: 1,
    enabled: true,
    filters: [],
    hideShorts: "sí"
  }
  values.distrautState = invalid
  await assert.rejects(getStoredState(), /formato no compatible/)
  await assert.rejects(setShortsHidden(false), /formato no compatible/)
  assert.equal(values.distrautState, invalid)
  const errors: Error[] = []
  const stop = subscribeToStoredState(
    () => assert.fail("No debe emitir un estado incompatible"),
    (error) => errors.push(error)
  )
  for (const listener of listeners) {
    listener({ distrautState: { newValue: invalid } }, "local")
  }
  assert.equal(errors.length, 1)
  stop()
})

test("pausa y reanudación persisten sin consumir tiempo ni perder el descanso", async () => {
  await assert.rejects(setStudySessionPaused(true), /sesión en curso/)
  await startStudySession(60, true)
  const session = (await getStoredState()).session!
  assert.equal(session.endsAt - session.startedAt, 65 * 60000)
  const paused = (await setStudySessionPaused(true)).session!
  assert.equal(
    (await setStudySessionPaused(true)).session!.pausedAt,
    paused.pausedAt
  )
  const originalNow = Date.now
  try {
    Date.now = () => paused.pausedAt! + 10 * 60000
    const resumed = (await setStudySessionPaused(false)).session!
    assert.equal(resumed.endsAt - session.endsAt, 10 * 60000)
    assert.equal(resumed.startedAt - session.startedAt, 10 * 60000)
    assert.equal(resumed.pausedAt, undefined)
    assert.equal(resumed.breaks, true)
    assert.deepEqual((await setStudySessionPaused(false)).session, resumed)
  } finally {
    Date.now = originalNow
  }
  values.distrautState = {
    schemaVersion: 1,
    enabled: true,
    filters: [],
    session: { ...session, pausedAt: session.endsAt }
  }
  await assert.rejects(getStoredState(), /sesión guardada/)
})

test("el reloj persiste, vence y se puede finalizar sin borrar filtros", async () => {
  await addFilter("keyword", "React")
  await assert.rejects(startStudySession(0), /duración/)
  await assert.rejects(startStudySession(241), /duración/)
  await assert.rejects(startStudySession(1.5), /duración/)
  await startStudySession(25)
  const state = await getStoredState()
  assert.equal(state.session!.endsAt - state.session!.startedAt, 25 * 60000)
  assert.equal(shouldHideVideo(state, { title: "React" }), true)
  const ended = {
    ...state,
    session: { startedAt: Date.now() - 60001, endsAt: Date.now() - 1 }
  }
  assert.equal(shouldHideVideo(ended, { title: "React" }), false)
  await setFilteringEnabled(false)
  assert.deepEqual((await getStoredState()).session, state.session)
  assert.equal((await endStudySession()).enabled, false)
  const untimed = await useUntimedFiltering()
  assert.equal(untimed.session, undefined)
  assert.equal(shouldHideVideo(untimed, { title: "React" }), true)
  values.distrautState = {
    ...untimed,
    session: { startedAt: 1, endsAt: "invalid" }
  }
  await assert.rejects(getStoredState(), /sesión guardada/)
})

test("conserva reglas antiguas y gestiona cada aparición solo en su origen", async () => {
  const legacy = {
    id: "previo",
    value: "Juego",
    type: "keyword",
    enabled: true
  }
  values.distrautState = { schemaVersion: 1, enabled: true, filters: [legacy] }
  const group = (await addCollection("Juegos")).collections![0]
  await assert.rejects(addCollection(" juégos "), /Ya existe/)
  await Promise.all([
    addFilter("keyword", "juego", group.id),
    addFilter("channel", "Canal", group.id)
  ])
  await assert.rejects(addFilter("keyword", "juégo", group.id), /Ya existe/)
  const state = await setCollectionEnabled(group.id, false)
  assert.equal(shouldHideVideo(state, { title: "Juego" }), true)
  assert.equal(shouldHideVideo(state, { channelName: "Canal" }), false)
  const entry = state.filters.find(
    (f) => f.collectionId && f.type === "keyword"
  )!
  await setFilterEnabled(entry.id, false)
  await removeFilter("previo")
  const resumed = await setCollectionEnabled(group.id, true)
  assert.equal(shouldHideVideo(resumed, { title: "Juego" }), false)
  assert.equal(shouldHideVideo(resumed, { channelName: "Canal" }), true)
  await addFilter("channel", "Canal")
  const remaining = await removeCollection(group.id)
  assert.deepEqual(
    remaining.filters.map((f) => f.collectionId),
    [undefined]
  )
  await assert.rejects(
    addFilter("keyword", "React", group.id),
    /No se encontró/
  )
})

beforeEach(() => {
  values = {}
  failWrite = false
  listeners = new Set()
  globalThis.chrome = {
    storage: {
      onChanged: {
        addListener: (listener: Listener) => listeners.add(listener),
        removeListener: (listener: Listener) => listeners.delete(listener)
      },
      local: {
        get: async (key: string) => ({ [key]: values[key] }),
        set: async (items: Record<string, unknown>) => {
          if (failWrite) throw new Error("No se pudo guardar")
          const oldValue = values.distrautState
          Object.assign(values, structuredClone(items))
          for (const listener of listeners) {
            listener(
              { distrautState: { oldValue, newValue: values.distrautState } },
              "local"
            )
          }
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

test("avisa cambios locales, informa datos inválidos y limpia la suscripción", async () => {
  const received: StoredState[] = []
  const errors: Error[] = []
  const unsubscribe = subscribeToStoredState(
    (state) => received.push(state),
    (error) => errors.push(error)
  )

  await addFilter("keyword", "React")
  assert.equal(received.length, 1)
  assert.equal(received[0].filters[0].value, "React")

  for (const listener of listeners) {
    listener({ distrautState: { newValue: { schemaVersion: 2 } } }, "local")
    listener({ distrautState: { newValue: {} } }, "sync")
    listener({ otherKey: { newValue: {} } }, "local")
  }
  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /formato no compatible/)
  assert.equal(received.length, 1)

  for (const listener of listeners) {
    listener({ distrautState: { newValue: undefined } }, "local")
  }
  assert.deepEqual(received[1], {
    schemaVersion: 1,
    enabled: true,
    filters: []
  })

  unsubscribe()
  await setFilteringEnabled(false)
  assert.equal(received.length, 2)
})
