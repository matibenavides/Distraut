import type {
  Filter,
  FilterCollection,
  FilterType,
  StoredState
} from "../types/filter"
import { parseCollectionJson } from "./collection-json"
import {
  createFilter,
  MAX_COLLECTION_NAME_LENGTH,
  normalizeFilterValue
} from "./filters"
import {
  addPlaybackInterval,
  localDay,
  settleStudyTime,
  weekDays
} from "./statistics"

const STORAGE_KEY = "distrautState"

export async function getStoredState(): Promise<StoredState> {
  const stored: unknown = (await chrome.storage.local.get(STORAGE_KEY))[
    STORAGE_KEY
  ]
  return parseStoredState(stored)
}

function parseStoredState(stored: unknown): StoredState {
  if (stored === undefined) {
    return { schemaVersion: 1, enabled: true, filters: [] }
  }

  if (
    typeof stored !== "object" ||
    stored === null ||
    !("schemaVersion" in stored) ||
    stored.schemaVersion !== 1 ||
    !("enabled" in stored) ||
    typeof stored.enabled !== "boolean" ||
    ("hideShorts" in stored && typeof stored.hideShorts !== "boolean") ||
    ("hideSuggested" in stored && typeof stored.hideSuggested !== "boolean") ||
    !("filters" in stored) ||
    !Array.isArray(stored.filters) ||
    !stored.filters.every(isFilter) ||
    ("collections" in stored &&
      (!Array.isArray(stored.collections) ||
        !stored.collections.every(isCollection)))
  ) {
    throw new Error("Los filtros guardados tienen un formato no compatible.")
  }

  const state = stored as StoredState
  if (state.statistics !== undefined) {
    const stats = state.statistics
    const count = (n: unknown) =>
      typeof n === "number" && Number.isSafeInteger(n) && n >= 0
    const dayKey = (value: unknown) =>
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    if (
      !stats ||
      typeof stats !== "object" ||
      !count(stats.videos) ||
      !count(stats.shorts) ||
      !stats.studyByDay ||
      typeof stats.studyByDay !== "object" ||
      Array.isArray(stats.studyByDay) ||
      !Object.entries(stats.studyByDay).every(
        ([day, duration]) => dayKey(day) && count(duration)
      ) ||
      (stats.playbackByDay !== undefined &&
        (!stats.playbackByDay ||
          typeof stats.playbackByDay !== "object" ||
          Array.isArray(stats.playbackByDay) ||
          !Object.entries(stats.playbackByDay).every(
            ([day, duration]) => dayKey(day) && count(duration)
          ))) ||
      (stats.hidden !== undefined &&
        (!stats.hidden ||
          typeof stats.hidden !== "object" ||
          !dayKey(stats.hidden.firstDay) ||
          !stats.hidden.byWeek ||
          typeof stats.hidden.byWeek !== "object" ||
          Array.isArray(stats.hidden.byWeek) ||
          !Object.entries(stats.hidden.byWeek).every(
            ([week, totals]) =>
              dayKey(week) &&
              totals &&
              count(totals.videos) &&
              count(totals.shorts)
          )))
    )
      throw new Error(
        "Las estadísticas guardadas tienen un formato no compatible."
      )
  }
  if (state.session !== undefined) {
    const session = state.session
    if (
      typeof session !== "object" ||
      session === null ||
      !Number.isFinite(session.startedAt) ||
      !Number.isFinite(session.endsAt) ||
      (session.accountedThrough !== undefined &&
        (!Number.isFinite(session.accountedThrough) ||
          session.accountedThrough < session.startedAt ||
          session.accountedThrough > session.endsAt)) ||
      session.endsAt <= session.startedAt ||
      session.endsAt - session.startedAt >
        (session.breaks ? 275 : 240) * 60000 ||
      (session.breaks !== undefined && typeof session.breaks !== "boolean") ||
      (session.pausedAt !== undefined &&
        (!Number.isFinite(session.pausedAt) ||
          session.pausedAt < session.startedAt ||
          session.pausedAt >= session.endsAt))
    )
      throw new Error("La sesión guardada tiene un formato no compatible.")
  }
  const ids = new Set(state.collections?.map((group) => group.id))
  if (
    ids.size !== (state.collections?.length ?? 0) ||
    state.filters.some(
      (filter) =>
        filter.collectionId !== undefined && !ids.has(filter.collectionId)
    )
  )
    throw new Error("Los filtros guardados tienen una colección no compatible.")
  return state
}

function isCollection(value: unknown): value is FilterCollection {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    !!value.id &&
    "name" in value &&
    typeof value.name === "string" &&
    !!value.name.trim() &&
    "enabled" in value &&
    typeof value.enabled === "boolean" &&
    (!("createdFrom" in value) ||
      value.createdFrom === "keyword" ||
      value.createdFrom === "channel")
  )
}

export function subscribeToStoredState(
  onChange: (state: StoredState) => void,
  onError: (error: Error) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string
  ) => {
    if (area !== "local" || !(STORAGE_KEY in changes)) return

    let state: StoredState
    try {
      state = parseStoredState(changes[STORAGE_KEY].newValue)
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)))
      return
    }
    onChange(state)
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

function isFilter(value: unknown): value is Filter {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "type" in value &&
    (value.type === "keyword" || value.type === "channel") &&
    "value" in value &&
    typeof value.value === "string" &&
    (!("collectionId" in value) || typeof value.collectionId === "string") &&
    "enabled" in value &&
    typeof value.enabled === "boolean"
  )
}

function updateState(
  change: (state: StoredState) => StoredState
): Promise<StoredState> {
  return navigator.locks.request(STORAGE_KEY, async () => {
    const state = change(settleStudyTime(await getStoredState()))
    await chrome.storage.local.set({ [STORAGE_KEY]: state })
    return state
  })
}

export async function addFilter(
  type: FilterType,
  value: string,
  collectionId?: string
): Promise<StoredState> {
  return updateState((state) => {
    if (collectionId !== undefined) requireCollection(state, collectionId)
    const filter = createFilter(
      type,
      value,
      state.filters.filter((f) => f.collectionId === collectionId)
    )
    if (collectionId !== undefined) filter.collectionId = collectionId
    return { ...state, filters: [...state.filters, filter] }
  })
}

export async function setFilterEnabled(
  id: string,
  enabled: boolean
): Promise<StoredState> {
  return updateState((state) => {
    if (!state.filters.some((filter) => filter.id === id)) {
      throw new Error("No se encontró el filtro.")
    }
    return {
      ...state,
      filters: state.filters.map((filter) =>
        filter.id === id ? { ...filter, enabled } : filter
      )
    }
  })
}

export async function removeFilter(id: string): Promise<StoredState> {
  return updateState((state) => {
    if (!state.filters.some((filter) => filter.id === id)) {
      throw new Error("No se encontró el filtro.")
    }
    return {
      ...state,
      filters: state.filters.filter((filter) => filter.id !== id)
    }
  })
}

export async function setFilteringEnabled(
  enabled: boolean
): Promise<StoredState> {
  return updateState((state) => ({ ...state, enabled }))
}

export function setShortsHidden(hideShorts: boolean): Promise<StoredState> {
  return updateState((state) => ({ ...state, hideShorts }))
}

export function setSuggestedHidden(
  hideSuggested: boolean
): Promise<StoredState> {
  return updateState((state) => ({ ...state, hideSuggested }))
}

export function initializeHiddenCounts(now = Date.now()) {
  return updateState((state) => {
    const statistics = state.statistics ?? {
      videos: 0,
      shorts: 0,
      studyByDay: {}
    }
    return {
      ...state,
      statistics: {
        ...statistics,
        hidden: statistics.hidden ?? { firstDay: localDay(now), byWeek: {} }
      }
    }
  })
}

export function recordHiddenCounts(
  videos: number,
  shorts: number,
  now = Date.now()
) {
  if (![videos, shorts].every((n) => Number.isSafeInteger(n) && n >= 0))
    return Promise.reject(new Error("Recuento de ocultaciones inválido."))
  const week = weekDays(now)[0]
  const day = localDay(now)
  return updateState((state) => {
    const statistics = state.statistics ?? {
      videos: 0,
      shorts: 0,
      studyByDay: {}
    }
    const hidden = statistics.hidden
    const previous = hidden?.byWeek[week]
    const totals = {
      videos: (previous?.videos ?? 0) + videos,
      shorts: (previous?.shorts ?? 0) + shorts
    }
    if (
      !Number.isSafeInteger(totals.videos) ||
      !Number.isSafeInteger(totals.shorts)
    )
      throw new Error("Se alcanzó el límite del contador.")
    return {
      ...state,
      statistics: {
        ...statistics,
        hidden: {
          firstDay: hidden && hidden.firstDay < day ? hidden.firstDay : day,
          byWeek: { ...hidden?.byWeek, [week]: totals }
        }
      }
    }
  })
}

export function recordPlayback(start: number, end: number) {
  if (
    ![start, end].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    end <= start ||
    end - start > 86400000 ||
    end > Date.now() + 60000
  )
    return Promise.reject(new Error("Intervalo de reproducción inválido."))
  return updateState((state) => {
    const statistics = state.statistics ?? {
      videos: 0,
      shorts: 0,
      studyByDay: {}
    }
    return {
      ...state,
      statistics: {
        ...statistics,
        playbackByDay: addPlaybackInterval(
          statistics.playbackByDay ?? {},
          start,
          end
        )
      }
    }
  })
}

export function startStudySession(minutes: number, breaks = false) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240)
    return Promise.reject(new Error("Elige una duración de 1 a 240 minutos."))
  return updateState((state) => {
    const startedAt = Date.now()
    return {
      ...state,
      enabled: true,
      session: {
        startedAt,
        endsAt:
          startedAt +
          (minutes + (breaks ? Math.floor((minutes - 1) / 30) * 5 : 0)) * 60000,
        breaks
      }
    }
  })
}

export function setStudySessionPaused(paused: boolean) {
  return updateState((state) => {
    const session = state.session
    const now = Date.now()
    if (!session || (session.pausedAt ?? now) >= session.endsAt)
      throw new Error("No hay una sesión en curso.")
    if (paused) {
      return {
        ...state,
        session: { ...session, pausedAt: session.pausedAt ?? now }
      }
    }
    if (session.pausedAt === undefined) return state
    const shift = now - session.pausedAt
    const { pausedAt, ...running } = session
    return {
      ...state,
      session: {
        ...running,
        accountedThrough: now,
        startedAt: session.startedAt + shift,
        endsAt: session.endsAt + shift
      }
    }
  })
}

export function endStudySession() {
  return updateState(({ session, ...state }) => ({ ...state, enabled: false }))
}

export function useUntimedFiltering() {
  return updateState(({ session, ...state }) => ({ ...state, enabled: true }))
}

function requireCollection(state: StoredState, id: string) {
  const group = state.collections?.find((group) => group.id === id)
  if (!group) throw new Error("No se encontró la colección.")
  return group
}

// Un ID sin origen representa un filtro individual.
type FilterSelection = readonly (string | Pick<Filter, "id" | "collectionId">)[]

function assignFilters(
  state: StoredState,
  selection: FilterSelection,
  group?: FilterCollection
) {
  const selected = new Map<string, string | undefined>()
  for (const entry of selection) {
    if (typeof entry === "string") selected.set(entry, undefined)
    else selected.set(entry.id, entry.collectionId)
  }
  const rules = state.filters.filter((rule) => selected.has(rule.id))
  if (
    !selected.size ||
    rules.length !== selected.size ||
    rules.some((rule) => rule.collectionId !== selected.get(rule.id))
  )
    throw new Error("La selección cambió. Revisa los filtros seleccionados.")

  const key = (rule: Filter) =>
    rule.type + ":" + normalizeFilterValue(rule.value)
  const existing = new Set(
    state.filters.filter((rule) => rule.collectionId === group?.id).map(key)
  )
  for (const rule of rules) {
    if (rule.collectionId === group?.id) continue
    if (existing.has(key(rule)))
      throw new Error(
        `El filtro «${rule.value}» ya existe en el destino o se repite en la selección. Revisa la selección para moverla a «${group?.name ?? "Individuales"}».`
      )
    existing.add(key(rule))
  }
  return {
    ...state,
    filters: state.filters.map((rule) => {
      if (!selected.has(rule.id) || rule.collectionId === group?.id) return rule
      if (group) return { ...rule, collectionId: group.id }
      const { collectionId, ...individual } = rule
      return individual
    })
  }
}

export function moveFiltersToCollection(
  selection: FilterSelection,
  groupId?: string
) {
  return updateState((state) =>
    assignFilters(
      state,
      selection,
      groupId === undefined ? undefined : requireCollection(state, groupId)
    )
  )
}

function createCollection(
  state: StoredState,
  name: string,
  createdFrom?: FilterType
): FilterCollection {
  if (
    createdFrom !== undefined &&
    createdFrom !== "keyword" &&
    createdFrom !== "channel"
  )
    throw new Error("El origen de la colección no es compatible.")
  const groups = state.collections ?? []
  const normalized = normalizeFilterValue(name)
  if (!normalized) throw new Error("Escribe un nombre para la colección.")
  if (name.trim().length > MAX_COLLECTION_NAME_LENGTH)
    throw new Error(
      `El nombre de la colección admite hasta ${MAX_COLLECTION_NAME_LENGTH} caracteres.`
    )
  if (groups.some((group) => normalizeFilterValue(group.name) === normalized))
    throw new Error("Ya existe una colección con ese nombre.")
  const group: FilterCollection = {
    id: crypto.randomUUID(),
    name: name.trim(),
    enabled: true
  }
  if (createdFrom !== undefined) group.createdFrom = createdFrom
  return group
}

export function addCollection(
  name: string,
  selection?: FilterSelection,
  createdFrom?: FilterType
) {
  return updateState((state) => {
    const group = createCollection(state, name, createdFrom)
    const next = {
      ...state,
      collections: [...(state.collections ?? []), group]
    }
    return selection ? assignFilters(next, selection, group) : next
  })
}

export async function importCollectionJson(text: string) {
  const data = parseCollectionJson(text)
  return updateState((state) => {
    const group = createCollection(state, data.name, data.createdFrom)
    group.enabled = data.enabled ?? true
    const rules = data.filters.map((rule) => ({
      ...rule,
      id: crypto.randomUUID(),
      collectionId: group.id
    }))
    return {
      ...state,
      collections: [...(state.collections ?? []), group],
      filters: [...state.filters, ...rules]
    }
  })
}

export function swapCollections(sourceId: string, targetId: string) {
  return updateState((state) => {
    const source = requireCollection(state, sourceId)
    const target = requireCollection(state, targetId)
    const collections = [...state.collections!]
    const from = collections.indexOf(source)
    const to = collections.indexOf(target)
    collections[from] = target
    collections[to] = source
    return { ...state, collections }
  })
}

export function setCollectionEnabled(id: string, enabled: boolean) {
  return updateState((state) => {
    requireCollection(state, id)
    return {
      ...state,
      collections: state.collections!.map((group) =>
        group.id === id ? { ...group, enabled } : group
      )
    }
  })
}

export function removeCollection(id: string) {
  return updateState((state) => {
    requireCollection(state, id)
    return {
      ...state,
      collections: state.collections!.filter((group) => group.id !== id),
      filters: state.filters.filter((filter) => filter.collectionId !== id)
    }
  })
}
