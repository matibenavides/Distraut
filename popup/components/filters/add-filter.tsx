import CheckOutlined from "@ant-design/icons/es/icons/CheckOutlined"
import FolderOutlined from "@ant-design/icons/es/icons/FolderOutlined"
import PlusOutlined from "@ant-design/icons/es/icons/PlusOutlined"
import { Button, Tabs } from "antd"
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type HTMLAttributes
} from "react"

import {
  addCollection,
  addFilter,
  moveFiltersToCollection,
  removeFilter
} from "../../../lib/storage"
import type {
  FilterCollection,
  FilterType,
  StoredState
} from "../../../types/filter"
import type { Save } from "../../types"

const dragType = "application/x-distraut-filters"

function FilterGroup({
  type,
  state,
  save,
  selected,
  toggle,
  startDrag,
  endDrag,
  dropTarget,
  busy
}: {
  type: FilterType
  state: StoredState
  save: Save
  selected: string[]
  toggle: (id: string) => void
  startDrag: (event: DragEvent, id: string) => void
  endDrag: () => void
  dropTarget: (
    group: FilterCollection,
    surface: FilterType
  ) => HTMLAttributes<HTMLElement>
  busy: boolean
}) {
  const [value, setValue] = useState("")
  const [message, setMessage] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const keyword = type === "keyword"
  const title = keyword ? "Ocultar palabra" : "Ocultar canal"
  const [activeGroup, setActiveGroup] = useState("")
  const byCollection = new Map<string, StoredState["filters"]>()
  for (const rule of state.filters) {
    if (rule.type !== type) continue
    const id = rule.collectionId ?? ""
    const entries = byCollection.get(id)
    if (entries) entries.push(rule)
    else byCollection.set(id, [rule])
  }
  const rules = (byCollection.get("") ?? []).reverse()
  const groups = (state.collections ?? []).filter((group) =>
    byCollection.has(group.id)
  )

  useEffect(() => {
    if (message && input.current?.getClientRects().length) input.current.focus()
  }, [message])

  const individualChips = rules.length > 0 && (
    <ul
      className="filter-chips"
      aria-label={keyword ? "Palabras individuales" : "Canales individuales"}>
      {rules.map((rule) => (
        <li
          key={rule.id}
          className="filter-chip"
          data-selected={selected.includes(rule.id)}
          data-enabled={rule.enabled}>
          <button
            type="button"
            className="select-chip"
            draggable={!busy}
            onDragStart={(e) => startDrag(e, rule.id)}
            onDragEnd={endDrag}
            onClick={() => toggle(rule.id)}
            aria-pressed={selected.includes(rule.id)}>
            {selected.includes(rule.id) && <CheckOutlined aria-hidden="true" />}
            {rule.value}
            {!rule.enabled && <span className="chip-paused"> · en pausa</span>}
          </button>
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
  )

  return (
    <div className="filter-group" data-type={type}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setMessage("")
          if (await save(() => addFilter(type, value))) {
            setActiveGroup("")
            setMessage(`«${value.trim()}» añadido.`)
            setValue("")
          }
        }}>
        <label className="filter-group-title" htmlFor={`new-${type}`}>
          {title}
        </label>
        <div className="filter-entry">
          <input
            ref={input}
            id={`new-${type}`}
            required
            value={value}
            placeholder={
              keyword
                ? "Palabra o frase del título"
                : "Nombre completo del canal"
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
      </form>
      {groups.length ? (
        <Tabs
          className="chip-tabs"
          size="small"
          tabBarGutter={14}
          aria-label={
            keyword ? "Palabras por colección" : "Canales por colección"
          }
          activeKey={
            groups.some((group) => group.id === activeGroup) ? activeGroup : ""
          }
          onChange={setActiveGroup}
          items={[
            {
              key: "",
              label: "Individuales",
              children: individualChips || (
                <small>Sin filtros individuales.</small>
              )
            },
            ...groups.map((group) => ({
              key: group.id,
              label: (
                <span
                  className="chip-tab-name"
                  title={group.name}
                  {...dropTarget(group, type)}>
                  <FolderOutlined aria-hidden="true" /> {group.name}
                </span>
              ),
              children: (
                <>
                  {!group.enabled && <small>Colección en pausa</small>}
                  <ul
                    className="filter-chips collection-chips"
                    aria-label={`${keyword ? "Palabras" : "Canales"} de ${group.name}`}>
                    {byCollection.get(group.id)!.map((rule) => (
                      <li
                        key={rule.id}
                        className="filter-chip"
                        data-enabled={rule.enabled}>
                        <span>
                          {rule.value}
                          {!rule.enabled && " · en pausa"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )
            }))
          ]}
        />
      ) : (
        individualChips
      )}
      <small className="feedback" role="status">
        {message}
      </small>
    </div>
  )
}

export function AddFilter({
  state,
  save,
  busy
}: {
  state: StoredState
  save: Save
  busy: boolean
}) {
  const [marked, setMarked] = useState<string[]>([])
  const [over, setOver] = useState("")
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [notice, setNotice] = useState("")
  const [dragged, setDragged] = useState<string[]>([])
  const composer = useRef<HTMLDivElement>(null)
  const selected = state.filters
    .filter((rule) => !rule.collectionId && marked.includes(rule.id))
    .map((rule) => rule.id)

  useEffect(() => {
    if (notice && composer.current?.getClientRects().length)
      composer.current.querySelector("input")?.focus()
  }, [notice])

  function toggle(id: string) {
    setNotice("")
    setMarked(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id]
    )
  }
  function startDrag(e: DragEvent, id: string) {
    if (busy) {
      e.preventDefault()
      return
    }
    const ids = selected.includes(id) ? selected : [...selected, id]
    setDragged(ids)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData(dragType, "selection")
    setMarked(ids)
    setNotice("")
  }
  function endDrag() {
    setDragged([])
    setOver("")
  }
  async function transfer(
    ids: string[],
    destination: string,
    groupId?: string
  ) {
    if (busy || !ids.length) return
    if (
      await save(() =>
        groupId
          ? moveFiltersToCollection(ids, groupId)
          : addCollection(destination, ids)
      )
    ) {
      setMarked([])
      setCreating(false)
      setName("")
      setNotice(
        `${ids.length === 1 ? "1 filtro en" : ids.length + " filtros en"} «${destination.trim()}».`
      )
    }
  }
  function dropTarget(group: FilterCollection, surface: FilterType | "panel") {
    const target = `${surface}:${group.id}`
    function accepts(e: DragEvent) {
      return (
        !busy && dragged.length > 0 && e.dataTransfer.types.includes(dragType)
      )
    }
    return {
      "data-over": over === target,
      onDragOver(e: DragEvent) {
        if (!accepts(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        setOver(target)
      },
      onDragLeave(e: DragEvent) {
        if (
          e.relatedTarget instanceof Node &&
          e.currentTarget.contains(e.relatedTarget)
        )
          return
        setOver((current) => (current === target ? "" : current))
      },
      onDrop(e: DragEvent) {
        if (!accepts(e)) return
        e.preventDefault()
        endDrag()
        void transfer(dragged, group.name, group.id)
      }
    }
  }
  const controls = {
    state,
    save,
    busy,
    selected,
    toggle,
    startDrag,
    endDrag,
    dropTarget
  }
  return (
    <div className="filter-composer" ref={composer}>
      <p className="filter-intro">
        Selecciona o arrastra etiquetas para agruparlas.
      </p>
      <FilterGroup type="keyword" {...controls} />
      <FilterGroup type="channel" {...controls} />
      {selected.length > 0 && (
        <div className="move-panel" data-dragging={dragged.length > 0}>
          <div className="row">
            <strong>
              {selected.length === 1
                ? "1 filtro seleccionado"
                : `${selected.length} filtros seleccionados`}
            </strong>
            <button
              type="button"
              onClick={() => {
                composer.current
                  ?.querySelector<HTMLButtonElement>(
                    '.select-chip[aria-pressed="true"]'
                  )
                  ?.focus()
                setMarked([])
                setCreating(false)
              }}>
              Cancelar
            </button>
          </div>
          <small>
            {state.collections?.length
              ? "Suelta la selección o pulsa una colección."
              : "Crea una colección para esta selección."}
          </small>
          <div className="move-targets">
            {state.collections?.map((group) => (
              <Button
                key={group.id}
                icon={<FolderOutlined />}
                disabled={busy}
                {...dropTarget(group, "panel")}
                onClick={() => void transfer(selected, group.name, group.id)}>
                {group.name}
                {!group.enabled && " · pausada"}
              </Button>
            ))}
          </div>
          {creating ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void transfer(selected, name)
              }}>
              <input
                aria-label="Nombre de la nueva colección"
                placeholder="Nombre de la colección"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button htmlType="submit" type="primary" disabled={busy}>
                Crear y mover
              </Button>
            </form>
          ) : (
            <Button
              type="link"
              icon={<PlusOutlined />}
              disabled={busy}
              onClick={() => setCreating(true)}>
              Nueva colección
            </Button>
          )}
        </div>
      )}
      <small className="feedback" role="status">
        {notice}
      </small>
    </div>
  )
}
