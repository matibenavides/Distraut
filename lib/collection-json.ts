import type { Filter, FilterCollection, FilterType } from "../types/filter"
import { normalizeFilterValue } from "./filters"

export const MAX_COLLECTION_JSON_BYTES = 1024 * 1024

export interface CollectionDraft {
  name: string
  enabled?: boolean
  createdFrom?: FilterType
  filters: Pick<Filter, "type" | "value" | "enabled">[]
}

interface CollectionDocument extends CollectionDraft {
  version: 1
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFilterType(value: unknown): value is FilterType {
  return value === "keyword" || value === "channel"
}

export function validateCollectionTextSize(text: string) {
  if (new TextEncoder().encode(text).length > MAX_COLLECTION_JSON_BYTES)
    throw new Error("El contenido supera el máximo de 1 MiB.")
}

export function parseCollectionJson(text: string): CollectionDocument {
  validateCollectionTextSize(text)
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ""))
  } catch {
    throw new Error("El archivo debe contener JSON válido.")
  }
  if (!isRecord(data) || data.version !== 1)
    throw new Error("Se esperaba una colección JSON con version 1.")
  if (typeof data.name !== "string" || !Array.isArray(data.filters))
    throw new Error("La colección requiere un nombre y una lista de filtros.")
  if (data.enabled !== undefined && typeof data.enabled !== "boolean")
    throw new Error("El estado de la colección debe ser true o false.")
  if (data.createdFrom !== undefined && !isFilterType(data.createdFrom))
    throw new Error("El origen de la colección debe ser keyword o channel.")

  const seen = new Set<string>()
  const filters = data.filters.map((item: unknown, index: number) => {
    if (
      !isRecord(item) ||
      !isFilterType(item.type) ||
      typeof item.value !== "string" ||
      (item.enabled !== undefined && typeof item.enabled !== "boolean")
    )
      throw new Error(
        `El filtro ${index + 1} tiene un tipo, texto o estado inválido.`
      )

    const normalized = normalizeFilterValue(item.value)
    if (!normalized) throw new Error(`El filtro ${index + 1} está vacío.`)
    const key = `${item.type}:${normalized}`
    if (seen.has(key))
      throw new Error(`El filtro «${item.value}» está duplicado en el archivo.`)
    seen.add(key)
    return {
      type: item.type,
      value: item.value.trim(),
      enabled: item.enabled !== false
    }
  })
  return {
    version: 1,
    name: data.name,
    enabled: data.enabled !== false,
    createdFrom: isFilterType(data.createdFrom) ? data.createdFrom : undefined,
    filters
  }
}

export function serializeCollectionJson(
  group: FilterCollection,
  filters: readonly Filter[]
) {
  const data: CollectionDocument = {
    version: 1,
    name: group.name,
    enabled: group.enabled,
    createdFrom: group.createdFrom,
    filters: filters
      .filter((filter) => filter.collectionId === group.id)
      .map(({ type, value, enabled }) => ({ type, value, enabled }))
  }
  return JSON.stringify(data, null, 2) + "\n"
}
