import { Button, Checkbox, InputNumber, Statistic } from "antd"
import { useState } from "react"

import { getSessionTiming } from "../../../lib/session"
import {
  endStudySession,
  setStudySessionPaused,
  startStudySession,
  useUntimedFiltering
} from "../../../lib/storage"
import type { StoredState } from "../../../types/filter"
import type { Save } from "../../types"

export function StudySession({
  state,
  save,
  now
}: {
  state: StoredState
  save: Save
  now: number
}) {
  const [minutes, setMinutes] = useState<number | null>(30)
  const [breaks, setBreaks] = useState(true)
  const timing = getSessionTiming(state.session, now)
  const active = timing && !timing.finished
  const breakCount = minutes && breaks ? Math.floor((minutes - 1) / 30) : 0
  const label = timing?.paused
    ? "En pausa"
    : timing?.finished
      ? "Finalizada"
      : timing?.resting
        ? "Descanso"
        : active
          ? "Concentración"
          : "Prepara tu sesión"
  return (
    <section
      className="session-panel"
      data-phase={timing?.resting ? "break" : "focus"}
      aria-labelledby="session-title">
      <div className="row">
        <h2 id="session-title">Sesión de estudio</h2>
        <span className="session-label" role="status">
          {label}
        </span>
      </div>
      {timing && (
        <>
          <div className="clock-row row">
            {active && !timing.paused ? (
              <Statistic.Timer
                key={timing.nextBoundary}
                className="session-clock"
                type="countdown"
                value={timing.nextBoundary}
                format="HH:mm:ss"
                title={
                  timing.resting
                    ? "Descanso restante"
                    : "Concentración restante"
                }
              />
            ) : (
              <Statistic
                className="session-clock"
                title={timing.paused ? "Tiempo detenido" : "Sesión terminada"}
                value={timing.remaining}
                formatter={() =>
                  new Date(timing.remaining).toISOString().slice(11, 19)
                }
              />
            )}
          </div>
          <progress
            aria-label="Progreso de la sesión completa"
            max={timing.duration}
            value={timing.elapsed}
          />
        </>
      )}
      {active ? (
        <>
          <div className="row session-actions">
            <Button
              type="primary"
              onClick={() => save(() => setStudySessionPaused(!timing.paused))}>
              {timing.paused ? "Reanudar sesión" : "Pausar sesión"}
            </Button>
            <Button onClick={() => save(endStudySession)}>Finalizar</Button>
          </div>
          <small className="session-help">
            {timing.paused
              ? "Reloj y filtrado detenidos hasta que reanudes."
              : timing.resting
                ? "Descanso de 5 minutos. El filtrado se reanudará al terminar."
                : state.enabled
                  ? "Tus filtros están activos durante la concentración."
                  : "Filtrado desactivado. El reloj sigue contando."}
          </small>
          {state.session?.breaks && !timing.resting && (
            <small>
              Descanso de 5 min tras cada 30 min si queda concentración.
            </small>
          )}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save(() => startStudySession(minutes ?? 0, breaks))
          }}>
          <label htmlFor="session-minutes">Minutos de concentración</label>
          <div className="duration-picker">
            <Button
            style={{ paddingBottom: "4px", fontWeight: "bold" }}
              aria-label="Restar 5 minutos" 
              disabled={minutes === null || minutes <= 5}
              onClick={() => setMinutes(Math.max(5, (minutes ?? 30) - 5))}>
              −
            </Button>
            <InputNumber
              id="session-minutes"
              min={5}
              max={240}
              step={5}
              precision={0}
              controls={false}
              value={minutes}
              onChange={(value) =>
                setMinutes(value === null ? null : Number(value))
              }
              suffix="min"
              aria-label="Minutos de concentración"
            />
            <Button
              style={{ paddingBottom: "4px", fontWeight: "bold" }}
              aria-label="Sumar 5 minutos"
              disabled={minutes !== null && minutes >= 240}
              onClick={() => setMinutes(Math.min(240, (minutes ?? 30) + 5))}>
              +
            </Button>
          </div>
          <Checkbox
            checked={breaks}
            onChange={(e) => setBreaks(e.target.checked)}>
            Descansos de 5 min cada 30 min
          </Checkbox>
          <p className="duration-summary">
            {breakCount
              ? `${minutes} min de concentración + ${breakCount * 5} min de descanso`
              : "Concentración continua durante el tiempo elegido."}
          </p>
          <Button
            block
            type="primary"
            htmlType="submit"
            disabled={minutes === null || minutes < 5 || minutes > 240}>
            Comenzar sesión
          </Button>
        </form>
      )}
      {timing?.finished && (
        <button onClick={() => save(useUntimedFiltering)}>
          Activar filtros sin temporizador
        </button>
      )}
      {!active && <small>Al finalizar la sesión se detiene el filtrado.</small>}
    </section>
  )
}
