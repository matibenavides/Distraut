import { useEffect, useRef, useState } from "react"

import { addFilter, removeFilter } from "../../../lib/storage"
import type { FilterType, StoredState } from "../../../types/filter"
import type { Save } from "../../types"

function FilterGroup({
  type,
  state,
  save
}: {
  type: FilterType
  state: StoredState
  save: Save
}) {
  const [value, setValue] = useState("")
  const [message, setMessage] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const keyword = type === "keyword"
  const title = keyword ? "Ocultar palabra" : "Ocultar canal"
  const rules = state.filters
    .filter((rule) => rule.type === type && !rule.collectionId)
    .reverse()

  useEffect(() => {
    if (message && input.current?.getClientRects().length) input.current.focus()
  }, [message])

  return (
    <form
      className="filter-group"
      data-type={type}
      onSubmit={async (e) => {
        e.preventDefault()
        setMessage("")
        if (await save(() => addFilter(type, value))) {
          setMessage(`«${value.trim()}» añadido.`)
          setValue("")
        }
      }}>
      <label className="filter-group-title" htmlFor={`new-${type}`}>
        {title}
        <span className="filter-count">{rules.length}</span>
      </label>
      <div className="filter-entry">
        <input
          ref={input}
          id={`new-${type}`}
          required
          value={value}
          placeholder={
            keyword ? "Palabra o frase del título" : "Nombre completo del canal"
          }
          onChange={(e) => {
            setValue(e.target.value)
            setMessage("")
          }}
        />
        <button
          className="primary"
          aria-label={keyword ? "Añadir palabra clave" : "Añadir canal"}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {!!rules.length && (
        <ul className="filter-chips" aria-label={`${title} individuales`}>
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="filter-chip"
              data-enabled={rule.enabled}>
              <span>
                {rule.value}
                {!rule.enabled && (
                  <span className="chip-paused"> · en pausa</span>
                )}
              </span>
              <button
                type="button"
                aria-label={`Quitar ${keyword ? "palabra clave" : "canal"} ${rule.value}`}
                onClick={async () => {
                  setMessage("")
                  if (await save(() => removeFilter(rule.id)))
                    setMessage(`«${rule.value}» eliminado.`)
                }}>
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <small className="feedback" role="status">
        {message}
      </small>
    </form>
  )
}

export function AddFilter({ state, save }: { state: StoredState; save: Save }) {
  return (
    <div className="filter-composer">
      <p className="filter-intro">Filtros individuales. Añade con Enter o +.</p>
      <FilterGroup type="keyword" state={state} save={save} />
      <FilterGroup type="channel" state={state} save={save} />
    </div>
  )
}
