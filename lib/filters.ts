import type { Filter, FilterCollection, FilterType } from "../types/filter"

export const MAX_COLLECTION_NAME_LENGTH = 24

export function orderedCollections(
  collections: readonly FilterCollection[] = []
) {
  return [...collections].reverse()
}

export function normalizeFilterValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function createFilter(
  type: FilterType,
  value: string,
  existingFilters: readonly Filter[]
): Filter {
  if (type !== "keyword" && type !== "channel") {
    throw new Error("El tipo de filtro debe ser palabra clave o canal.")
  }

  const trimmedValue = value.trim()
  const normalizedValue = normalizeFilterValue(trimmedValue)

  if (!normalizedValue) {
    throw new Error("Escribe una palabra clave o un nombre de canal.")
  }

  const duplicate = existingFilters.some(
    (filter) =>
      filter.type === type &&
      normalizeFilterValue(filter.value) === normalizedValue
  )

  if (duplicate) {
    throw new Error("Ya existe un filtro de ese tipo con el mismo valor.")
  }

  return {
    id: crypto.randomUUID(),
    type,
    value: trimmedValue,
    enabled: true
  }
}
