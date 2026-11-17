import { ConfigProvider, Switch } from "antd"
import { useEffect, useRef, useState } from "react"

import {
  addCollection,
  getStoredState,
  removeCollection,
  setCollectionEnabled,
  setFilteringEnabled,
  subscribeToStoredState,
  useUntimedFiltering
} from "../lib/storage"
import type { FilterCollection, StoredState } from "../types/filter"
import { AddFilter } from "./add-filter"
import { RuleLibrary } from "./rule-library"
import { StudySession } from "./study-session"
import { popupTheme } from "./theme"

import "./popup.css"

export type Save = (operation: () => Promise<StoredState>) => Promise<boolean>

function IndexPopup() {
  const [state, setState] = useState<StoredState>()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [view, setView] = useState<"home" | "collections" | "rules">("home")
  const [origin, setOrigin] = useState("")
  const [fromCollections, setFromCollections] = useState(false)
  const [name, setName] = useState("")
  const [deleting, setDeleting] = useState("")
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    setNow(Date.now())
    if (!state?.session) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [state?.session?.endsAt])
  const expired = !!state?.session && state.session.endsAt <= now
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let current = true
    let changed = false
    function receive(next: StoredState) {
      setState(next)
      setError("")
    }
    function failed(err: Error) {
      setState(undefined)
      setError(err.message)
    }
    const unsubscribe = subscribeToStoredState(
      (next) => {
        changed = true
        receive(next)
      },
      (err) => {
        changed = true
        failed(err)
      }
    )
    getStoredState()
      .then((next) => {
        if (current && !changed) receive(next)
      })
      .catch((err) => {
        if (current && !changed) failed(err)
      })
    return () => {
      current = false
      unsubscribe()
    }
  }, [attempt])

  useEffect(() => {
    heading.current?.focus()
  }, [view])

  const save: Save = async (operation) => {
    setBusy(true)
    setError("")
    try {
      // onChanged also updates other open popups and YouTube tabs.
      await operation()
      return true
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el cambio."
      )
      return false
    } finally {
      setBusy(false)
    }
  }
  function openRules(id = "") {
    setOrigin(id)
    setFromCollections(view === "collections")
    setView("rules")
  }
  const groups = state?.collections ?? []
  function collectionRow(group: FilterCollection) {
    const rules = state!.filters.filter(
      (rule) => rule.collectionId === group.id
    )
    const titles = rules.filter((rule) => rule.type === "keyword").length
    return (
      <div key={group.id} className="collection-row">
        <div className="row">
          <button
            className="collection-name"
            onClick={() => openRules(group.id)}>
            <strong>{group.name}</strong>
            <small>
              {titles} palabras · {rules.length - titles} canales
            </small>
          </button>
          <button
            className="pill"
            aria-label={`${group.enabled ? "Pausar" : "Reanudar"} ${group.name}`}
            aria-pressed={group.enabled}
            onClick={() =>
              save(() => setCollectionEnabled(group.id, !group.enabled))
            }>
            {group.enabled ? "Activa" : "Pausada"}
          </button>
        </div>
        {view === "collections" &&
          (deleting === group.id ? (
            <div className="row">
              <span>¿Eliminar con sus filtros?</span>
              <button onClick={() => setDeleting("")}>Cancelar</button>
              <button
                onClick={async () => {
                  if (await save(() => removeCollection(group.id)))
                    setDeleting("")
                }}>
                Eliminar
              </button>
            </div>
          ) : (
            <button
              aria-label={`Eliminar ${group.name}`}
              onClick={() => setDeleting(group.id)}>
              Eliminar colección
            </button>
          ))}
      </div>
    )
  }
  return (
    <ConfigProvider theme={popupTheme}>
      <main className="popup">
        {view !== "home" && (
          <button
            className="back"
            onClick={() => {
              setDeleting("")
              setView(
                view === "rules" && fromCollections ? "collections" : "home"
              )
              setError("")
            }}>
            ‹ Volver
          </button>
        )}
        <div className="row">
          <h1 ref={heading} tabIndex={-1}>
            {view === "home"
              ? "Distraut"
              : view === "rules"
                ? "Palabras y canales"
                : "Colecciones"}
          </h1>
          {view === "home" && state && (
            <span className="status" data-on={state.enabled && !expired}>
              {expired
                ? "Sesión finalizada"
                : state.enabled
                  ? "Filtrado activo"
                  : "Filtrado en pausa"}
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!state ? (
          error ? (
            <button onClick={() => setAttempt((n) => n + 1)}>
              Volver a cargar
            </button>
          ) : (
            <p role="status">Cargando reglas…</p>
          )
        ) : (
          <fieldset disabled={busy} aria-busy={busy}>
            {view === "home" && (
              <>
                <StudySession state={state} save={save} now={now} />
                <div className="filter-control row">
                  <label htmlFor="filtering">Activar filtrado en YouTube</label>
                  <Switch
                    id="filtering"
                    checked={state.enabled && !expired}
                    disabled={busy}
                    onChange={(enabled) =>
                      save(() =>
                        enabled && expired
                          ? useUntimedFiltering()
                          : setFilteringEnabled(enabled)
                      )
                    }
                  />
                </div>
                <section>
                  <AddFilter state={state} save={save} />
                </section>
                <section>
                  <div className="row">
                    <h2>Colecciones</h2>
                    <button onClick={() => setView("collections")}>
                      {groups.length
                        ? `Ver todas (${groups.length})`
                        : "Crear colección"}
                    </button>
                  </div>
                  {groups[0] ? (
                    collectionRow(groups[0])
                  ) : (
                    <p>Agrupa palabras y canales para pausarlos juntos.</p>
                  )}
                </section>
                <section className="row">
                  <div>
                    <h2>Palabras y canales ocultos</h2>
                    <p>{state.filters.length} filtros guardados</p>
                  </div>
                  <button className="primary" onClick={() => openRules()}>
                    Ver y editar ›
                  </button>
                </section>
              </>
            )}
            {view === "collections" && (
              <>
                <form
                  className="create-form"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (await save(() => addCollection(name))) setName("")
                  }}>
                  <label htmlFor="group-name">Nueva colección</label>
                  <div className="row">
                    <input
                      id="group-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej. Juegos"
                      required
                    />
                    <button className="primary">Crear</button>
                  </div>
                </form>
                <div className="collection-list">
                  {groups.map(collectionRow)}
                </div>
                {!groups.length && <p>Todavía no tienes colecciones.</p>}
              </>
            )}
            {view === "rules" && (
              <RuleLibrary state={state} initialOrigin={origin} save={save} />
            )}
          </fieldset>
        )}
      </main>
    </ConfigProvider>
  )
}
export default IndexPopup
