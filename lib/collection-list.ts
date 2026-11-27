import type { FilterType } from "../types/filter"
import { validateCollectionTextSize } from "./collection-json"
import { normalizeFilterValue } from "./filters"

export function parseCollectionList(
  text: string,
  type: FilterType,
  format?: "text" | "json"
) {
  validateCollectionTextSize(text)
  const source = text.trim()
  const json =
    format === "json" || (format === undefined && /^[\[{]/.test(source))
  const filters: { type: FilterType; value: string; enabled: boolean }[] = []
  const seen = new Set<string>()

  function addList(entries: unknown, kind: FilterType) {
    const label = kind === "keyword" ? "palabras" : "canales"
    if (!Array.isArray(entries))
      throw new Error(`La lista de ${label} debe contener textos.`)
    for (const [index, entry] of entries.entries()) {
      if (typeof entry !== "string")
        throw new Error(`La entrada ${index + 1} de ${label} debe ser texto.`)
      const value = entry.trim()
      const normalized = normalizeFilterValue(value)
      if (!normalized) continue
      const key = `${kind}:${normalized}`
      if (seen.has(key)) continue
      seen.add(key)
      filters.push({ type: kind, value, enabled: true })
    }
  }

  if (json) {
    let data: unknown
    try {
      data = JSON.parse(source)
    } catch {
      throw new Error("Revisa la sintaxis del JSON de la lista.")
    }
    if (Array.isArray(data)) addList(data, type)
    else if (
      data &&
      typeof data === "object" &&
      Object.keys(data).length > 0 &&
      Object.keys(data).every((key) => key === "palabras" || key === "canales")
    ) {
      if ("palabras" in data) addList(data.palabras, "keyword")
      if ("canales" in data) addList(data.canales, "channel")
    } else {
      throw new Error(
        "Usa una lista de textos o un objeto con listas de palabras y canales."
      )
    }
  } else {
    addList(source.split(/\r\n|\n|\r/), type)
  }

  if (!filters.length)
    throw new Error("Agrega al menos una palabra o un canal.")
  return filters
}
