import { useState } from "react"

import { addFilter } from "../../../lib/storage"
import type { FilterType, StoredState } from "../../../types/filter"
import type { Save } from "../../types"

export function AddFilter({
  state,
  save,
  collectionId = ""
}: {
  state: StoredState
  save: Save
  collectionId?: string
}) {
  const [type, setType] = useState<FilterType>("keyword")
  const [value, setValue] = useState("")
  const [destination, setDestination] = useState(collectionId)
  const [message, setMessage] = useState("")
  const groups = state.collections ?? []
  const selected = groups.some((group) => group.id === destination)
    ? destination
    : ""
  return (
    <form
      className="create-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setMessage("")
        if (await save(() => addFilter(type, value, selected || undefined))) {
          setMessage(`Filtro «${value.trim()}» guardado.`)
          setValue("")
        }
      }}>
      <h2>Ocultar palabras o canales</h2>
      <label htmlFor="filter-type">Qué quieres ocultar</label>
      <select
        id="filter-type"
        value={type}
        onChange={(e) => {
          setType(e.target.value as FilterType)
          setMessage("")
        }}>
        <option value="keyword">Videos cuyo título contenga…</option>
        <option value="channel">Videos de este canal…</option>
      </select>
      <label htmlFor="new-rule">
        {type === "keyword"
          ? "Palabra o frase del título"
          : "Nombre completo del canal"}
      </label>
      <input
        id="new-rule"
        required
        placeholder={
          type === "keyword" ? "Ej. Minecraft" : "Ej. Luisito Comunica"
        }
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setMessage("")
        }}
      />
      <div className="destination-row">
        <div>
          <label htmlFor="destination">Guardar en</label>
          <select
            id="destination"
            value={selected}
            onChange={(e) => setDestination(e.target.value)}>
            <option value="">Filtros individuales</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
        <button className="primary">Añadir filtro</button>
      </div>
      <small className="feedback" role="status">
        {message ||
          "Se aplica en YouTube al guardarlo si el filtrado está activo."}
      </small>
    </form>
  )
}
