import CheckOutlined from "@ant-design/icons/es/icons/CheckOutlined"
import CloseOutlined from "@ant-design/icons/es/icons/CloseOutlined"
import FolderAddOutlined from "@ant-design/icons/es/icons/FolderAddOutlined"
import FolderOutlined from "@ant-design/icons/es/icons/FolderOutlined"
import { Button, Tabs } from "antd"
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type HTMLAttributes
} from "react"

import {
  collectionVisibleForType,
  MAX_COLLECTION_NAME_LENGTH,
  orderedCollections
} from "../../../lib/filters"
import {
  addCollection,
  addFilter,
  moveFiltersToCollection,
  removeFilter,
  swapCollections
} from "../../../lib/storage"
import type {
  Filter,
  FilterCollection,
  FilterType,
  StoredState
} from "../../../types/filter"
import type { Save } from "../../types"

const dragType = "application/x-distraut-filters"
const folderDragType = "application/x-distraut-collection"

function FilterGroup({
  type,
  state,
  save,
  selected,
  toggle,
  startDrag,
  endDrag,
  dropTarget,
  createWithSelection,
  busy
}: {
  type: FilterType
  state: StoredState
  save: Save
  selected: ReadonlySet<string>
  toggle: (rule: Filter) => void
  startDrag: (event: DragEvent, rule: Filter) => void
  endDrag: () => void
  createWithSelection: (name: string, type: FilterType) => Promise<boolean>
  dropTarget: (
    group: FilterCollection | undefined,
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
  const [collectionName, setCollectionName] = useState<string | null>(null)
  const collectionTrigger = useRef<HTMLButtonElement>(null)
  const editingCollection = collectionName !== null
  const byCollection = new Map<string, StoredState["filters"]>()
  for (const rule of state.filters) {
    if (rule.type !== type) continue
    const id = rule.collectionId ?? ""
    const entries = byCollection.get(id)
    if (entries) entries.push(rule)
    else byCollection.set(id, [rule])
  }
  const rules = (byCollection.get("") ?? []).reverse()
  const groups = orderedCollections(state.collections).filter((group) =>
    collectionVisibleForType(group, state.filters, type)
  )

  useEffect(() => {
    if (message && input.current?.getClientRects().length) input.current.focus()
  }, [message])

  function removeButton(rule: Filter, collectionName?: string) {
    const origin = collectionName ? ` de la colección ${collectionName}` : ""
    return (
      <button
        type="button"
        aria-label={`Quitar ${keyword ? "palabra clave" : "canal"} ${rule.value}${origin}`}
        onClick={async () => {
          setMessage("")
          if (await save(() => removeFilter(rule.id)))
            setMessage(`Se eliminó «${rule.value}»${origin}.`)
        }}>
        <span aria-hidden="true">×</span>
      </button>
    )
  }

  function renderChip(rule: Filter, group?: FilterCollection) {
    return (
      <li
        key={rule.id}
        className="filter-chip"
        data-selected={selected.has(rule.id)}
        data-enabled={rule.enabled}>
        <button
          type="button"
          className="select-chip"
          draggable={!busy}
          onDragStart={(e) => startDrag(e, rule)}
          onDragEnd={endDrag}
          onClick={() => toggle(rule)}
          aria-pressed={selected.has(rule.id)}>
          {selected.has(rule.id) && <CheckOutlined aria-hidden="true" />}
          {rule.value}
          {!rule.enabled && <span className="chip-paused"> · en pausa</span>}
        </button>
        {removeButton(rule, group?.name)}
      </li>
    )
  }
  const individualChips = rules.length > 0 && (
    <ul
      className="filter-chips"
      aria-label={keyword ? "Palabras individuales" : "Canales individuales"}>
      {rules.map((rule) => renderChip(rule))}
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
      <Tabs
        className="chip-tabs"
        size="small"
        tabBarGutter={14}
        tabBarExtraContent={
          <Button
            ref={collectionTrigger}
            className="new-collection-trigger"
            size="small"
            type="text"
            disabled={busy}
            icon={editingCollection ? <CloseOutlined /> : <FolderAddOutlined />}
            aria-expanded={editingCollection}
            aria-controls={
              editingCollection ? `collection-editor-${type}` : undefined
            }
            aria-label={
              editingCollection ? "Cerrar nueva colección" : "Nueva colección"
            }
            title={editingCollection ? "Cerrar" : "Nueva colección"}
            onClick={() => {
              setMessage("")
              setCollectionName(editingCollection ? null : "")
            }}>
            {editingCollection ? "Cerrar" : "Nueva"}
          </Button>
        }
        renderTabBar={(props, TabBar) => (
          <>
            <TabBar {...props} />
            {editingCollection && (
              <form
                className="collection-tab-form"
                id={`collection-editor-${type}`}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault()
                    setCollectionName(null)
                    collectionTrigger.current?.focus()
                  }
                }}
                onSubmit={async (event) => {
                  event.preventDefault()
                  if (
                    await save(() =>
                      addCollection(collectionName, undefined, type)
                    )
                  ) {
                    setCollectionName(null)
                    setMessage(`Colección «${collectionName.trim()}» creada.`)
                  }
                }}>
                <input
                  autoFocus
                  required
                  aria-label="Nombre de la nueva colección"
                  placeholder={`Nombre (máx. ${MAX_COLLECTION_NAME_LENGTH})`}
                  title={`Máximo ${MAX_COLLECTION_NAME_LENGTH} caracteres`}
                  maxLength={MAX_COLLECTION_NAME_LENGTH}
                  value={collectionName}
                  onChange={(event) => {
                    setCollectionName(event.target.value)
                    setMessage("")
                  }}
                />
                <Button
                  size="small"
                  htmlType="submit"
                  type="primary"
                  aria-label="Crear colección"
                  title="Crear colección"
                  disabled={busy}>
                  Crear
                </Button>
                {selected.size > 0 && collectionName.trim() && (
                  <Button
                    size="small"
                    disabled={busy}
                    onClick={async () => {
                      if (await createWithSelection(collectionName, type))
                        setCollectionName(null)
                    }}>
                    Crear y mover
                  </Button>
                )}
              </form>
            )}
          </>
        )}
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
            label: (
              <span className="chip-tab-name" {...dropTarget(undefined, type)}>
                Individuales
              </span>
            ),
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
                {byCollection.has(group.id) ? (
                  <ul
                    className="filter-chips collection-chips"
                    aria-label={`${keyword ? "Palabras" : "Canales"} de ${group.name}`}>
                    {byCollection
                      .get(group.id)!
                      .map((rule) => renderChip(rule, group))}
                  </ul>
                ) : (
                  <small>
                    {keyword
                      ? "Sin palabras en esta colección."
                      : "Sin canales en esta colección."}
                  </small>
                )}
              </>
            )
          }))
        ]}
      />
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
  const [marked, setMarked] = useState<Filter[]>([])
  const [over, setOver] = useState("")
  const [notice, setNotice] = useState("")
  const [dragged, setDragged] = useState<Filter[]>([])
  const [draggedFolder, setDraggedFolder] = useState<string>()
  const composer = useRef<HTMLDivElement>(null)
  const origins = new Map(marked.map((rule) => [rule.id, rule.collectionId]))
  const selected = state.filters.filter(
    (rule) => origins.has(rule.id) && origins.get(rule.id) === rule.collectionId
  )
  const selectedIds = new Set(selected.map((rule) => rule.id))
  const destinations: (FilterCollection | undefined)[] = orderedCollections(
    state.collections
  )
  if (selected.some((rule) => rule.collectionId !== undefined))
    destinations.unshift(undefined)

  useEffect(() => {
    if (notice && composer.current?.getClientRects().length)
      composer.current.querySelector("input")?.focus()
  }, [notice])

  function toggle(rule: Filter) {
    setNotice("")
    setMarked(
      selectedIds.has(rule.id)
        ? selected.filter((item) => item.id !== rule.id)
        : [...selected, rule]
    )
  }
  function startDrag(e: DragEvent, rule: Filter) {
    if (busy) {
      e.preventDefault()
      return
    }
    const batch = selectedIds.has(rule.id) ? selected : [...selected, rule]
    setDragged(batch)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData(dragType, "selection")
    setMarked(batch)
    setNotice("")
  }
  function endDrag() {
    setDragged([])
    setDraggedFolder(undefined)
    setOver("")
  }
  async function transfer(
    batch: Filter[],
    destination: FilterCollection | string | undefined,
    createdFrom?: FilterType
  ) {
    if (busy || !batch.length) return false
    const newCollection = typeof destination === "string"
    if (
      !newCollection &&
      batch.every((rule) => rule.collectionId === destination?.id)
    )
      return false
    if (
      await save(() =>
        newCollection
          ? addCollection(destination, batch, createdFrom)
          : moveFiltersToCollection(batch, destination?.id)
      )
    ) {
      setMarked([])
      setNotice(
        `${batch.length === 1 ? "1 filtro en" : batch.length + " filtros en"} «${newCollection ? destination.trim() : destination?.name ?? "Individuales"}».`
      )
      return true
    }
    return false
  }
  function dropTarget(
    group: FilterCollection | undefined,
    surface: FilterType | "panel"
  ) {
    const target = `${surface}:${group?.id ?? ""}`
    const folderTab = !!group && surface !== "panel"
    function accepts(e: DragEvent) {
      if (busy) return false
      if (draggedFolder)
        return (
          folderTab &&
          group.id !== draggedFolder &&
          e.dataTransfer.types.includes(folderDragType)
        )
      return (
        dragged.some((rule) => rule.collectionId !== group?.id) &&
        e.dataTransfer.types.includes(dragType)
      )
    }
    return {
      draggable: folderTab && !busy,
      onDragStart(e: DragEvent) {
        if (!folderTab || busy) return
        e.dataTransfer.setData(folderDragType, group.id)
        e.dataTransfer.effectAllowed = "move"
        setDraggedFolder(group.id)
      },
      onDragEnd: endDrag,
      "data-over": over === target,
      "data-reorder": !!draggedFolder && over === target,
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
        if (draggedFolder && group) {
          void save(() => swapCollections(draggedFolder, group.id))
        } else {
          void transfer(dragged, group)
        }
      }
    }
  }
  const controls = {
    state,
    save,
    busy,
    selected: selectedIds,
    toggle,
    startDrag,
    endDrag,
    dropTarget,
    createWithSelection: (name: string, type: FilterType) =>
      transfer(selected, name, type)
  }
  return (
    <div className="filter-composer" ref={composer}>
      <p className="filter-intro">
        Selecciona o arrastra etiquetas para moverlas.{" "}
        {(state.collections?.length ?? 0) > 1 &&
          "Arrastra una carpeta sobre otra para intercambiar su posición."}
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
                const visible = Array.from(
                  composer.current?.querySelectorAll<HTMLButtonElement>(
                    '.select-chip[aria-pressed="true"]'
                  ) ?? []
                ).find((button) => button.getClientRects().length)
                const focusTarget =
                  visible ?? composer.current?.querySelector("input")
                focusTarget?.focus()
                setMarked([])
              }}>
              Cancelar
            </button>
          </div>
          <small>
            {state.collections?.length
              ? "Suelta la selección o pulsa su destino."
              : "Crea una colección para esta selección."}
          </small>
          <div className="move-targets">
            {destinations.map((group) => (
              <Button
                key={group?.id ?? ""}
                icon={group && <FolderOutlined />}
                disabled={
                  busy ||
                  selected.every((rule) => rule.collectionId === group?.id)
                }
                {...dropTarget(group, "panel")}
                onClick={() => void transfer(selected, group)}>
                {group?.name ?? "Individuales"}
                {group?.enabled === false && " · pausada"}
              </Button>
            ))}
          </div>
        </div>
      )}
      <small className="feedback" role="status">
        {notice}
      </small>
    </div>
  )
}
