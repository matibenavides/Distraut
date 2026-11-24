import { Statistic } from "antd"

import { settleStudyTime } from "../lib/statistics"
import type { StoredState } from "../types/filter"

export function StatisticsPanel({
  state,
  error,
  now
}: {
  state?: StoredState
  error: string
  now: number
}) {
  if (!state)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Cargando estadísticas…"}
      </p>
    )
  const stats = settleStudyTime(state, now).statistics ?? {
    videos: 0,
    shorts: 0,
    studyByDay: {}
  }
  const days = Object.entries(stats.studyByDay).sort(([a], [b]) =>
    b.localeCompare(a)
  )
  return (
    <>
      <h1>Estadísticas</h1>
      <p>
        Tu actividad de filtrado y concentración, guardada en este dispositivo.
      </p>
      <section aria-label="Contenido ocultado">
        <Statistic
          title="Ocultaciones acumuladas"
          value={stats.videos + stats.shorts}
        />
        <div className="row statistics-counts">
          <Statistic title="Videos" value={stats.videos} />
          <Statistic title="Shorts" value={stats.shorts} />
        </div>
        <small>
          Cada contenido cuenta una vez por página cargada. Recargar o abrir
          otra pestaña puede sumarlo de nuevo.
        </small>
      </section>
      <section>
        <h2>Tiempo de estudio por día</h2>
        <p>Concentración de tus sesiones, sin pausas ni descansos.</p>
        {days.length ? (
          <table className="study-days">
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col">Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {days.map(([day, ms]) => {
                const seconds = Math.floor(ms / 1000)
                const duration = `${Math.floor(seconds / 3600)} h ${Math.floor(seconds / 60) % 60} min ${seconds % 60} s`
                return (
                  <tr key={day}>
                    <td>
                      {new Date(`${day}T12:00:00`).toLocaleDateString("es-CL")}
                    </td>
                    <td>{duration}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p role="status">Aún no hay tiempo de estudio registrado.</p>
        )}
        <small>
          Fechas locales. Una sesión en marcha sigue contando con el popup
          cerrado; no mide atención real. Las sesiones ya terminadas antes de
          esta función no se recuperan.
        </small>
      </section>
    </>
  )
}
