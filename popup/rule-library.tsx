import { useState } from "react"

import { normalizeFilterValue } from "../lib/filters"
import { removeFilter, setFilterEnabled } from "../lib/storage"
import type { FilterType, StoredState } from "../types/filter"
import { AddFilter } from "./add-filter"
import type { Save } from "./index"

const pageSize = 4
const individual = "individual"

export function RuleLibrary({
  state,
  initialOrigin,
  save
}: {
  state: StoredState
  initialOrigin: string
  save: Save
}) {
  const [origin, setOrigin] = useState(initialOrigin)
  const [type, setType] = useState<FilterType>("keyword")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const groups = state.collections ?? []
  const effectiveOrigin =
    origin === individual || groups.some((g) => g.id === origin) ? origin : ""
  const inOrigin = state.filters.filter(
    (rule) =>
      !effectiveOrigin || (rule.collectionId ?? individual) === effectiveOrigin
  )
  const search = normalizeFilterValue(query)
  const results = inOrigin.filter(
    (rule) =>
      rule.type === type && normalizeFilterValue(rule.value).includes(search)
  )
  const last = Math.max(0, Math.ceil(results.length / pageSize) - 1)
  const current = Math.min(page, last)
  const start = current * pageSize
  return (
    <>
      <AddFilter state={state} save={save} collectionId={initialOrigin} />
      <section>
        <h2>Filtros guardados</h2>
        <label htmlFor="origin">Mostrar filtros de</label>
        <select
          id="origin"
          value={effectiveOrigin}
          onChange={(e) => {
            setOrigin(e.target.value)
            setPage(0)
          }}>
          <option value="">Todas las colecciones e individuales</option>
          <option value={individual}>Filtros individuales</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <label htmlFor="saved-search">Buscar entre los filtros guardados</label>
        <input
          id="saved-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
          placeholder="Escribe para encontrar un filtro existente…"
        />
        <div className="row library-tools">
          <div className="types" role="group" aria-label="Tipo de regla">
            {(["keyword", "channel"] as const).map((kind) => (
              <button
                key={kind}
                aria-pressed={kind === type}
                onClick={() => {
                  setType(kind)
                  setPage(0)
                }}>
                {kind === "keyword" ? "Títulos" : "Canales"} ·{" "}
                {inOrigin.filter((r) => r.type === kind).length}
              </button>
            ))}
          </div>
        </div>
        <ul className="rules">
          {results.slice(start, start + pageSize).map((rule) => {
            const group = groups.find((g) => g.id === rule.collectionId)
            return (
              <li key={rule.id} className="row">
                <div className="rule-name">
                  <strong>{rule.value}</strong>
                  <small>
                    {group?.name ?? "Individual"}
                    {group && !group.enabled && " · En pausa"}
                  </small>
                </div>
                <button
                  aria-label={`${rule.enabled ? "Pausar" : "Reanudar"} ${rule.value}`}
                  onClick={() =>
                    save(() => setFilterEnabled(rule.id, !rule.enabled))
                  }>
                  {rule.enabled ? "Pausar" : "Reanudar"}
                </button>
                <button
                  aria-label={`Quitar ${rule.value} de ${group?.name ?? "Individuales"}`}
                  onClick={() => save(() => removeFilter(rule.id))}>
                  Quitar
                </button>
              </li>
            )
          })}
        </ul>
        {!results.length && (
          <p role="status">
            {query
              ? "No se encontraron filtros guardados con ese texto."
              : "Todavía no guardaste filtros de este tipo."}
          </p>
        )}
        {!!results.length && (
          <nav className="row pager" aria-label="Páginas de filtros">
            <small aria-live="polite">
              {start + 1}–{Math.min(start + pageSize, results.length)} de{" "}
              {results.length}
            </small>
            <button
              disabled={current === 0}
              onClick={() => setPage(current - 1)}>
              Anterior
            </button>
            <button
              disabled={current === last}
              onClick={() => setPage(current + 1)}>
              Siguiente ›
            </button>
          </nav>
        )}
      </section>
    </>
  )
}
