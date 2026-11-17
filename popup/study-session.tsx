import { useState } from "react"

import {
  endStudySession,
  startStudySession,
  useUntimedFiltering
} from "../lib/storage"
import type { StoredState } from "../types/filter"
import type { Save } from "./index"

export function StudySession({
  state,
  save,
  now
}: {
  state: StoredState
  save: Save
  now: number
}) {
  const [minutes, setMinutes] = useState("25")
  const session = state.session
  const remaining = session
    ? Math.max(0, Math.ceil((session.endsAt - now) / 1000))
    : 0
  const active = !!session && remaining > 0
  const clock = `${Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`
  return (
    <section className="session-panel" aria-labelledby="session-title">
      <div className="row">
        <h2 id="session-title">Sesión de estudio</h2>
        <span className="session-label">
          {active ? "En curso" : session ? "Finalizada" : "Elige tu tiempo"}
        </span>
      </div>
      {session && (
        <>
          <div className="row clock-row">
            <strong
              className="clock"
              aria-label={`${Math.floor(remaining / 60)} minutos y ${remaining % 60} segundos restantes`}>
              {clock}
            </strong>
            <small>{active ? "restantes" : "Sesión terminada"}</small>
          </div>
          <progress
            aria-label="Tiempo transcurrido"
            max={session.endsAt - session.startedAt}
            value={Math.min(
              session.endsAt - session.startedAt,
              Math.max(0, now - session.startedAt)
            )}
          />
        </>
      )}
      {active ? (
        <div className="row">
          <small>
            {state.enabled
              ? "Tus filtros están activos."
              : "Filtrado pausado. El reloj continúa."}
          </small>
          <button onClick={() => save(endStudySession)}>
            Finalizar sesión
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save(() => startStudySession(Number(minutes)))
          }}>
          <label htmlFor="session-minutes">Duración en minutos</label>
          <div className="row">
            <input
              id="session-minutes"
              type="number"
              min="1"
              max="240"
              step="1"
              required
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            <button className="primary">Comenzar sesión</button>
          </div>
        </form>
      )}
      {session && !active && (
        <button onClick={() => save(useUntimedFiltering)}>
          Activar filtros sin temporizador
        </button>
      )}
      {!session && (
        <small>
          Al terminar el tiempo, se detiene el filtrado de la sesión.
        </small>
      )}
    </section>
  )
}
