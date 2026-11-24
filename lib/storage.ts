import type {
  Filter,
  FilterCollection,
  FilterType,
  StoredState
} from "../types/filter"
import { createFilter, normalizeFilterValue } from "./filters"

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
  if (state.session !== undefined) {
    const session = state.session
    if (
      typeof session !== "object" ||
      session === null ||
      !Number.isFinite(session.startedAt) ||
      !Number.isFinite(session.endsAt) ||
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
    typeof value.enabled === "boolean"
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
    const state = change(await getStoredState())
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

export function addCollection(name: string) {
  return updateState((state) => {
    const groups = state.collections ?? []
    const normalized = normalizeFilterValue(name)
    if (!normalized) throw new Error("Escribe un nombre para la colección.")
    if (groups.some((group) => normalizeFilterValue(group.name) === normalized))
      throw new Error("Ya existe una colección con ese nombre.")
    const group = { id: crypto.randomUUID(), name: name.trim(), enabled: true }
    return { ...state, collections: [...groups, group] }
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
