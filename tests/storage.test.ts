import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"

import {
  MAX_COLLECTION_JSON_BYTES,
  serializeCollectionJson
} from "../lib/collection-json"
import {
  collectionVisibleForType,
  MAX_COLLECTION_NAME_LENGTH,
  orderedCollections
} from "../lib/filters"
import { shouldHideVideo } from "../lib/matching"
import { weekDays, weeklyHiddenCounts } from "../lib/statistics"
import {
  addCollection,
  addFilter,
  endStudySession,
  getStoredState,
  importCollectionJson,
  initializeHiddenCounts,
  moveFiltersToCollection,
  recordHiddenCounts,
  recordPlayback,
  removeCollection,
  removeFilter,
  setCollectionEnabled,
  setFilterEnabled,
  setFilteringEnabled,
  setShortsHidden,
  setStudySessionPaused,
  setSuggestedHidden,
  startStudySession,
  subscribeToStoredState,
  swapCollections,
  useUntimedFiltering
} from "../lib/storage"
import type { StoredState } from "../types/filter"

test("JSON conserva palabras, canales y pausas al exportar y volver a importar", async () => {
  await addFilter("keyword", "deadlock")
  const source = {
    version: 1,
    name: "Juegos",
    enabled: false,
    createdFrom: "keyword",
    filters: [
      { id: "externo", type: "keyword", value: "  deadlock ", enabled: false },
      { type: "channel", value: "Riot Games" }
    ]
  }
  const imported = await importCollectionJson(JSON.stringify(source))
  const group = imported.collections![0]
  assert.equal(group.enabled, false)
  assert.equal(group.createdFrom, "keyword")
  assert.deepEqual(
    imported.filters.map((rule) => [
      rule.type,
      rule.value,
      rule.enabled,
      rule.collectionId
    ]),
    [
      ["keyword", "deadlock", true, undefined],
      ["keyword", "deadlock", false, group.id],
      ["channel", "Riot Games", true, group.id]
    ]
  )
  assert.notEqual(imported.filters[1].id, "externo")

  const json = serializeCollectionJson(group, imported.filters)
  await removeCollection(group.id)
  const restored = await importCollectionJson(json)
  assert.equal(
    serializeCollectionJson(restored.collections![0], restored.filters),
    json
  )
  assert.notEqual(restored.collections![0].id, group.id)
})

test("JSON rechazado y los fallos de escritura preservan las colecciones guardadas", async () => {
  const before = await addCollection("Juegos")
  const input = {
    version: 1,
    name: "Nueva",
    filters: [{ type: "keyword", value: "Café" }]
  }
  await assert.rejects(importCollectionJson("{"), /JSON válido/)
  await assert.rejects(
    importCollectionJson(" ".repeat(MAX_COLLECTION_JSON_BYTES + 1)),
    /máximo/
  )
  await assert.rejects(
    importCollectionJson(JSON.stringify({ ...input, version: 2 })),
    /version 1/
  )
  await assert.rejects(
    importCollectionJson(JSON.stringify({ ...input, name: " Juégos " })),
    /Ya existe/
  )
  await assert.rejects(
    importCollectionJson(
      JSON.stringify({
        ...input,
        filters: [...input.filters, { type: "channel", value: " " }]
      })
    ),
    /vacío/
  )
  await assert.rejects(
    importCollectionJson(
      JSON.stringify({
        ...input,
        filters: [...input.filters, { type: "keyword", value: "CAFE" }]
      })
    ),
    /duplicado/
  )
  await assert.rejects(
    importCollectionJson(JSON.stringify({ ...input, enabled: "false" })),
    /estado/
  )
  failWrite = true
  await assert.rejects(importCollectionJson(JSON.stringify(input)), /guardar/)
  assert.deepEqual(await getStoredState(), before)
})

test("intercambiar carpetas no cambia las intermedias, las reglas ni las pausas", async () => {
  const a = (await addCollection("Juegos")).collections![0]
  const b = (await addCollection("Noticias")).collections![1]
  const c = (await addCollection("Música")).collections![2]
  await addFilter("keyword", "deadlock", a.id)
  const before = await setCollectionEnabled(c.id, false)
  const moved = await swapCollections(a.id, c.id)
  assert.deepEqual(
    orderedCollections(moved.collections).map((g) => g.id),
    [a.id, b.id, c.id]
  )
  assert.deepEqual(moved.filters, before.filters)
  assert.equal(moved.collections![0].enabled, false)
  await assert.rejects(swapCollections(a.id, "ausente"), /colección/)
  failWrite = true
  await assert.rejects(swapCollections(c.id, a.id), /guardar/)
  assert.deepEqual(await getStoredState(), moved)
})

test("el límite se aplica al crear carpetas y conserva los nombres antiguos", async () => {
  const name = "a".repeat(MAX_COLLECTION_NAME_LENGTH)
  const group = (await addCollection(name)).collections![0]
  const before = await addFilter("channel", "Canal Uno")
  await assert.rejects(addCollection(name + "a"), /caracteres/)
  await assert.rejects(addCollection(name + "a", before.filters), /caracteres/)
  assert.deepEqual(await getStoredState(), before)
  const legacy = { ...group, name: name + " antigua" }
  values.distrautState = { ...before, collections: [legacy] }
  const after = await addCollection("Nueva")
  assert.deepEqual(after.collections![0], legacy)
})

test("una carpeta nace en su apartado y aparece en el otro al recibir sus filtros", async () => {
  const created = await addCollection("Música", undefined, "channel")
  const group = created.collections![0]
  assert.equal(group.createdFrom, "channel")
  assert.equal(
    collectionVisibleForType(group, created.filters, "channel"),
    true
  )
  assert.equal(
    collectionVisibleForType(group, created.filters, "keyword"),
    false
  )
  const word = (await addFilter("keyword", "Conciertos")).filters[0]
  const moved = await moveFiltersToCollection([word], group.id)
  const reloaded = await getStoredState()
  assert.equal(reloaded.collections![0].createdFrom, "channel")
  assert.equal(
    collectionVisibleForType(group, reloaded.filters, "keyword"),
    true
  )
  assert.equal(
    collectionVisibleForType(group, reloaded.filters, "channel"),
    true
  )
  const emptied = await removeFilter(moved.filters[0].id)
  assert.equal(
    collectionVisibleForType(group, emptied.filters, "keyword"),
    false
  )
  const keyword = (await addCollection("Lectura", undefined, "keyword"))
    .collections![1]
  assert.equal(collectionVisibleForType(keyword, [], "channel"), false)
  const legacy = { id: "old", name: "Anterior", enabled: true }
  values.distrautState = { ...emptied, collections: [legacy] }
  assert.deepEqual((await getStoredState()).collections, [legacy])
  assert.equal(collectionVisibleForType(legacy, [], "keyword"), true)
  assert.equal(collectionVisibleForType(legacy, [], "channel"), true)
  values.distrautState = {
    ...emptied,
    collections: [{ ...group, createdFrom: "otro" }]
  }
  await assert.rejects(getStoredState(), /compatible/)
})

let values: Record<string, unknown>
let failWrite: boolean
type Listener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string
) => void
let listeners: Set<Listener>

test("sugeridos conserva preferencia manual, valida datos y propaga errores", async () => {
  assert.equal((await getStoredState()).hideSuggested, undefined)
  await setSuggestedHidden(true)
  await startStudySession(30)
  await setStudySessionPaused(true)
  assert.equal((await endStudySession()).hideSuggested, true)
  await setSuggestedHidden(false)
  failWrite = true
  await assert.rejects(setSuggestedHidden(true), /No se pudo guardar/)
  const previous = await getStoredState()
  assert.equal(previous.hideSuggested, false)
  values.distrautState = { ...previous, hideSuggested: "sí" }
  await assert.rejects(getStoredState(), /formato no compatible/)
})

test("reproducción de varias pestañas se suma sin pisar sesiones ni filtros", async () => {
  const start = Date.now() - 10000
  await addFilter("keyword", "React")
  await Promise.all([
    recordPlayback(start, start + 5000),
    recordPlayback(start, start + 5000)
  ])
  const state = await getStoredState()
  assert.equal(
    Object.values(state.statistics!.playbackByDay!).reduce((a, b) => a + b, 0),
    10000
  )
  assert.equal(state.filters.length, 1)
  await startStudySession(30)
  await recordHiddenCounts(1, 1)
  assert.deepEqual(
    (await getStoredState()).statistics?.playbackByDay,
    state.statistics?.playbackByDay
  )
  await assert.rejects(recordPlayback(start, start - 1), /inválido/)
  await assert.rejects(recordPlayback(start, Date.now() + 120000), /inválido/)
  failWrite = true
  await assert.rejects(
    recordPlayback(start, start + 1000),
    /No se pudo guardar/
  )
})

test("datos anteriores sin reproducción son válidos y valores corruptos se rechazan", async () => {
  await recordHiddenCounts(1, 1)
  const old = await getStoredState()
  assert.equal(old.statistics?.playbackByDay, undefined)
  values.distrautState = {
    ...old,
    statistics: { ...old.statistics, playbackByDay: { "2026-11-24": -1 } }
  }
  await assert.rejects(getStoredState(), /estadísticas guardadas/)
})

test("ocultaciones semanales aíslan el cambio de semana y conservan los datos anteriores", async () => {
  const sunday = new Date(2026, 10, 29, 23, 59, 59).getTime()
  const monday = new Date(2026, 10, 30, 0, 0, 0).getTime()
  await addFilter("keyword", "React")
  values.distrautState = {
    ...(await getStoredState()),
    statistics: {
      videos: 100,
      shorts: 200,
      studyByDay: { "2026-11-29": 60000 },
      playbackByDay: { "2026-11-29": 30000 }
    }
  }
  const started = await initializeHiddenCounts(sunday)
  assert.deepEqual(weeklyHiddenCounts(started.statistics!, weekDays(sunday)), {
    videos: 0,
    shorts: 0
  })
  await Promise.all([
    recordHiddenCounts(2, 1, sunday),
    recordHiddenCounts(3, 4, sunday),
    recordHiddenCounts(1, 2, monday)
  ])
  await initializeHiddenCounts(monday)
  const state = await getStoredState()
  assert.deepEqual(state.statistics, {
    ...started.statistics,
    hidden: {
      firstDay: "2026-11-29",
      byWeek: {
        "2026-11-23": { videos: 5, shorts: 5 },
        "2026-11-30": { videos: 1, shorts: 2 }
      }
    }
  })
  assert.deepEqual(weeklyHiddenCounts(state.statistics!, weekDays(sunday)), {
    videos: 5,
    shorts: 5
  })
  assert.deepEqual(weeklyHiddenCounts(state.statistics!, weekDays(monday)), {
    videos: 1,
    shorts: 2
  })
  assert.equal(
    weeklyHiddenCounts(state.statistics!, weekDays(sunday, -1)),
    undefined
  )
  assert.equal(state.filters.length, 1)
  await assert.rejects(recordHiddenCounts(-1, 0), /inválido/)
  values.distrautState = {
    ...state,
    statistics: { videos: -1, shorts: 0, studyByDay: {} }
  }
  await assert.rejects(getStoredState(), /estadísticas guardadas/)
  values.distrautState = {
    ...state,
    statistics: {
      ...state.statistics,
      hidden: { firstDay: "2026-11-29", byWeek: { "2026-11-23": null } }
    }
  }
  await assert.rejects(getStoredState(), /estadísticas guardadas/)
})

test("consolida tiempo al pausar, reanudar y terminar sin contar la pausa", async () => {
  const realNow = Date.now
  let clock = new Date(2026, 10, 24, 10).getTime()
  Date.now = () => clock
  try {
    await startStudySession(60, true)
    clock += 10 * 60000
    await setStudySessionPaused(true)
    clock += 20 * 60000
    await setStudySessionPaused(false)
    clock += 5 * 60000
    const ended = await endStudySession()
    assert.equal(ended.statistics?.studyByDay["2026-11-24"], 15 * 60000)
    assert.equal(ended.session, undefined)
  } finally {
    Date.now = realNow
  }
})

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
  const { accountedThrough, ...persistedSession } = (await getStoredState())
    .session!
  assert.deepEqual(persistedSession, state.session)
  assert.ok(
    accountedThrough === undefined ||
      accountedThrough >= state.session!.startedAt
  )
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

test("mueve palabras y canales juntos conservando sus IDs y pausas", async () => {
  const a = (await addFilter("keyword", "Arte")).filters[0]
  const b = (await addFilter("channel", "Arte")).filters[1]
  await setFilterEnabled(b.id, false)
  const other = (await addFilter("channel", "Otro")).filters[2]
  const group = (await addCollection("Estudio")).collections![0]
  await setCollectionEnabled(group.id, false)
  const moved = await moveFiltersToCollection([a.id, b.id], group.id)
  assert.deepEqual(moved.filters, [
    { ...a, collectionId: group.id },
    { ...b, enabled: false, collectionId: group.id },
    other
  ])
  assert.equal(shouldHideVideo(moved, { title: "Arte" }), false)
  const created = await addCollection("Lectura", [other.id])
  assert.equal(created.filters[2].collectionId, created.collections![1].id)
  assert.equal(created.filters[2].id, other.id)
})

test("mueve entre colecciones y devuelve a individuales conservando las pausas y las carpetas", async () => {
  const a = (await addCollection("Juegos")).collections![0]
  const b = (await addCollection("Ocio")).collections![1]
  const word = (await addFilter("keyword", "Deadlock", a.id)).filters[0]
  const channel = (await addFilter("channel", "Noticias", b.id)).filters[1]
  await setFilterEnabled(word.id, false)
  const moved = await moveFiltersToCollection([word, channel], b.id)
  assert.deepEqual(moved.filters, [
    { ...word, enabled: false, collectionId: b.id },
    channel
  ])
  await assert.rejects(moveFiltersToCollection([word]), /selección cambió/)
  const individual = await moveFiltersToCollection(moved.filters)
  assert.deepEqual(
    individual.filters,
    moved.filters.map(({ collectionId, ...rule }) => rule)
  )
  assert.deepEqual(individual.collections, [a, b])
  const grouped = await moveFiltersToCollection(individual.filters, a.id)
  const created = await addCollection("Nueva", grouped.filters)
  assert.ok(
    created.filters.every(
      (rule) => rule.collectionId === created.collections![2].id
    )
  )
})

test("homónimos entre orígenes o en Individuales rechazan el lote completo", async () => {
  const a = (await addCollection("A")).collections![0]
  const b = (await addCollection("B")).collections![1]
  const first = (await addFilter("keyword", "Café", a.id)).filters[0]
  const second = (await addFilter("keyword", "CAFE", b.id)).filters[1]
  const before = await getStoredState()
  await assert.rejects(moveFiltersToCollection([first, second]), /repite/)
  await assert.rejects(addCollection("Nueva", [first, second]), /repite/)
  assert.deepEqual(await getStoredState(), before)
  await moveFiltersToCollection([second])
  const individual = await getStoredState()
  await assert.rejects(moveFiltersToCollection([first]), /Individuales/)
  assert.deepEqual(await getStoredState(), individual)
})

test("rechaza el lote entero ante duplicados, selección obsoleta o fallo de escritura", async () => {
  const group = (await addCollection("Charlas")).collections![0]
  await addFilter("keyword", "Café", group.id)
  const a = (await addFilter("channel", "Canal")).filters[1]
  const b = (await addFilter("keyword", "cafe")).filters[2]
  const before = await getStoredState()
  await assert.rejects(
    moveFiltersToCollection([a.id, b.id], group.id),
    /ya existe/
  )
  await assert.rejects(
    moveFiltersToCollection([a.id], "eliminada"),
    /colección/
  )
  await assert.rejects(addCollection("Nueva", [a.id, "ausente"]), /selección/)
  await assert.rejects(addCollection("Chárlas", [a.id]), /Ya existe/)
  failWrite = true
  await assert.rejects(moveFiltersToCollection([a.id], group.id), /guardar/)
  assert.deepEqual(await getStoredState(), before)
  failWrite = false
  const race = await Promise.allSettled([
    moveFiltersToCollection([a.id], group.id),
    addCollection("Otro destino", [a.id])
  ])
  assert.equal(race.filter((result) => result.status === "fulfilled").length, 1)
  const after = await getStoredState()
  assert.equal(after.filters.length, before.filters.length)
  assert.ok(after.filters[1].collectionId)
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
