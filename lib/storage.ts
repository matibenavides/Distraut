import type { Filter, FilterType, StoredState } from "../types/filter"
import { createFilter } from "./filters"

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
    !("filters" in stored) ||
    !Array.isArray(stored.filters) ||
    !stored.filters.every(isFilter)
  ) {
    throw new Error("Los filtros guardados tienen un formato no compatible.")
  }

  return stored as StoredState
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
    "enabled" in value &&
    typeof value.enabled === "boolean"
  )
}

async function saveState(state: StoredState): Promise<StoredState> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state })
  return state
}

export async function addFilter(
  type: FilterType,
  value: string
): Promise<StoredState> {
  const state = await getStoredState()
  const filter = createFilter(type, value, state.filters)
  return saveState({ ...state, filters: [...state.filters, filter] })
}

export async function setFilterEnabled(
  id: string,
  enabled: boolean
): Promise<StoredState> {
  const state = await getStoredState()
  if (!state.filters.some((filter) => filter.id === id)) {
    throw new Error("No se encontró el filtro.")
  }
  return saveState({
    ...state,
    filters: state.filters.map((filter) =>
      filter.id === id ? { ...filter, enabled } : filter
    )
  })
}

export async function removeFilter(id: string): Promise<StoredState> {
  const state = await getStoredState()
  if (!state.filters.some((filter) => filter.id === id)) {
    throw new Error("No se encontró el filtro.")
  }
  return saveState({
    ...state,
    filters: state.filters.filter((filter) => filter.id !== id)
  })
}

export async function setFilteringEnabled(
  enabled: boolean
): Promise<StoredState> {
  const state = await getStoredState()
  return saveState({ ...state, enabled })
}
