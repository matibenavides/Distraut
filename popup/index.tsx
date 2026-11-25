import { ConfigProvider, Switch, Tabs } from "antd"
import { useEffect, useRef, useState } from "react"

import { getSessionTiming, isConcentrating } from "../lib/session"
import {
  addCollection,
  getStoredState,
  removeCollection,
  setCollectionEnabled,
  setFilteringEnabled,
  setShortsHidden,
  setSuggestedHidden,
  subscribeToStoredState,
  useUntimedFiltering
} from "../lib/storage"
import type { FilterCollection, StoredState } from "../types/filter"
import { AddFilter } from "./components/filters/add-filter"
import { RuleLibrary } from "./components/filters/rule-library"
import { StatisticsPanel } from "./components/statistics/statistics"
import { StudySession } from "./components/study-session/study-session"
import { popupTheme } from "./theme"
import type { Save } from "./types"

import "./popup.css"

function IndexPopup() {
  const [state, setState] = useState<StoredState>()
  const [tab, setTab] = useState("session")
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
    if (!state?.session && tab !== "statistics") return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [state?.session?.endsAt, tab])
  const timing = getSessionTiming(state?.session, now)
  const expired = !!timing?.finished
  const suggestedBySession = isConcentrating(state?.session, now)
  const inCollection =
    view === "rules"
      ? state?.collections?.find((group) => group.id === origin)
      : undefined
  const heading = useRef<HTMLHeadingElement>(null)
  const sessionHeading = useRef<HTMLHeadingElement>(null)
  const focusedBeforeSave = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!busy && document.activeElement === document.body) {
      const previous = focusedBeforeSave.current
      if (previous) {
        const target = previous.isConnected
          ? previous
          : tab === "session"
            ? sessionHeading.current
            : heading.current
        target?.focus()
        focusedBeforeSave.current = null
      }
    }
  }, [busy])

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
    focusedBeforeSave.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
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
  const feedback = (
    <>
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
      ) : null}
    </>
  )
  const sessionPanel = (
    <>
      <div className="row">
        <h1 ref={sessionHeading} tabIndex={-1}>
          Distraut
        </h1>
        {state && (
          <span
            className="status"
            data-on={
              state.enabled && !expired && !timing?.paused && !timing?.resting
            }>
            {timing?.paused
              ? "Sesión en pausa"
              : timing?.resting
                ? "Descanso"
                : expired
                  ? "Sesión finalizada"
                  : state.enabled
                    ? "Filtrado activo"
                    : "Filtrado en pausa"}
          </span>
        )}
      </div>
      {feedback}
      {state && (
        <fieldset disabled={busy} aria-busy={busy}>
          <StudySession state={state} save={save} now={now} />
          <div className="filter-control row">
            <label htmlFor="filtering">Habilitar filtros de YouTube</label>
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
          {(timing?.paused || timing?.resting) && (
            <small>
              La sesión reactivará los filtros habilitados al volver a
              concentración.
            </small>
          )}
          <div className="filter-control row">
            <label htmlFor="hide-shorts">Ocultar Shorts</label>
            <Switch
              id="hide-shorts"
              checked={state.hideShorts ?? false}
              disabled={busy}
              aria-describedby="shorts-help"
              onChange={(hidden) => save(() => setShortsHidden(hidden))}
            />
          </div>
          <small id="shorts-help">
            Independiente de los filtros y de la sesión de estudio.
          </small>
          <div className="filter-control row">
            <label htmlFor="hide-suggested">Ocultar videos sugeridos</label>
            <Switch
              id="hide-suggested"
              checked={!!state.hideSuggested || suggestedBySession}
              disabled={busy || suggestedBySession}
              aria-describedby="suggested-help"
              onChange={(hidden) => save(() => setSuggestedHidden(hidden))}
            />
          </div>
          <small id="suggested-help">
            {suggestedBySession
              ? "Activo por la sesión. Al pausar o finalizar se recupera tu selección independiente."
              : "Oculta el panel junto al reproductor. También se activa durante la concentración."}
          </small>
        </fieldset>
      )}
    </>
  )
  const filterPanel = (
    <>
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
          {view === "rules" && fromCollections
            ? "‹ Volver a colecciones"
            : "‹ Volver a filtros"}
        </button>
      )}
      <div className="row">
        <h1 ref={heading} tabIndex={-1}>
          {view === "home"
            ? "Filtros"
            : view === "rules"
              ? inCollection?.name ?? "Filtros guardados"
              : "Colecciones"}
        </h1>
      </div>
      {inCollection && (
        <p className="collection-context">
          Estás editando la colección <strong>{inCollection.name}</strong>
        </p>
      )}
      {feedback}
      {state && (
        <fieldset disabled={busy} aria-busy={busy}>
          {view === "home" && (
            <>
              <section aria-labelledby="hidden-filters-title">
                <h2 id="hidden-filters-title">Palabras y canales ocultos</h2>
                <AddFilter state={state} save={save} busy={busy} />
                <button
                  className="filter-library-link"
                  onClick={() => openRules()}>
                  Ver todos y gestionar ({state.filters.length}) ›
                </button>
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
              <div className="collection-list">{groups.map(collectionRow)}</div>
              {!groups.length && <p>Todavía no tienes colecciones.</p>}
            </>
          )}
          {view === "rules" && (
            <RuleLibrary
              key={inCollection?.id ?? "all"}
              state={state}
              initialOrigin={inCollection?.id ?? ""}
              save={save}
            />
          )}
        </fieldset>
      )}
    </>
  )
  return (
    <ConfigProvider theme={popupTheme}>
      <main
        className={`popup ${tab === "filters" && inCollection ? "popup-collection" : ""}`}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: "session", label: "Sesión", children: sessionPanel },
            { key: "filters", label: "Filtros", children: filterPanel },
            {
              key: "statistics",
              label: "Estadísticas",
              children: (
                <StatisticsPanel state={state} error={error} now={now} />
              )
            }
          ]}
        />
      </main>
    </ConfigProvider>
  )
}
export default IndexPopup
