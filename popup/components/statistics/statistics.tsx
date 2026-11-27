import { Button, Progress, Tag, Tooltip } from "antd"
import { useState } from "react"

import {
  formatTime,
  localDay,
  settleStudyTime,
  weekDays,
  weeklyHiddenCounts
} from "../../../lib/statistics"
import type { StoredState } from "../../../types/filter"

const progressLimit = 5 * 60 * 60000
const studyReference = 3 * 60 * 60000

export function StatisticsPanel({
  state,
  error,
  now
}: {
  state?: StoredState
  error: string
  now: number
}) {
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState(localDay(now))
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
  const days = weekDays(now, offset)
  const hidden = weeklyHiddenCounts(stats, days)
  const firstHiddenDay = stats.hidden?.firstDay
  const focus = days.includes(selected) ? selected : days[0]
  const playback = (day: string) => stats.playbackByDay?.[day] ?? 0
  const study = (day: string) => stats.studyByDay[day] ?? 0
  const hasActivity = days.some((day) => playback(day) > 0 || study(day) > 0)
  const dateLabel = (day: string) =>
    new Date(day + "T12:00:00").toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short"
    })
  return (
    <div className="weekly-statistics">
      <div className="row">
        <h1>Tu semana</h1>
        <Tag color="purple">Lun a dom</Tag>
      </div>
      <div className="daily-detail" aria-live="polite">
        <div className="row">
          <h2>{focus === localDay(now) ? "Hoy" : dateLabel(focus)}</h2>
          {offset !== 0 && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setOffset(0)
                setSelected(localDay(now))
              }}>
              Esta semana
            </Button>
          )}
        </div>
        <div className="daily-times">
          <div>
            <span>YouTube</span>
            <strong>{formatTime(playback(focus))}</strong>
            {playback(focus) > progressLimit && (
              <small className="daily-excess">
                +{formatTime(playback(focus) - progressLimit)} sobre la escala
              </small>
            )}
          </div>
          <div>
            <span>Concentración</span>
            <strong>{formatTime(study(focus))}</strong>
            {study(focus) > progressLimit && (
              <small className="daily-excess">
                +{formatTime(study(focus) - progressLimit)} sobre la escala
              </small>
            )}
          </div>
        </div>
      </div>
      <section
        className="week-chart-section"
        aria-label="Comparación diaria de lunes a domingo">
        <div className="chart-legend">
          <span>
            <i className="playback-dot" />
            Reproducción
          </span>
          <span>
            <i className="study-dot" />
            Concentración
          </span>
        </div>
        <div className="week-chart">
          {days.map((day, index) => (
            <Tooltip
              key={day}
              title={
                dateLabel(day) +
                ": " +
                formatTime(playback(day)) +
                " YouTube · " +
                formatTime(study(day)) +
                " concentración"
              }>
              <button
                className="week-day"
                aria-label={
                  dateLabel(day) +
                  ", reproducción " +
                  formatTime(playback(day)) +
                  ", concentración " +
                  formatTime(study(day))
                }
                aria-pressed={day === focus}
                onClick={() => setSelected(day)}>
                <span className="day-bars">
                  {[
                    {
                      value: playback(day),
                      color: "#378374",
                      label: "Reproducción"
                    },
                    {
                      value: study(day),
                      color: "#6141b8",
                      label: "Concentración"
                    }
                  ].map((metric) => (
                    <span className="bar-slot" key={metric.label}>
                      <Progress
                        className="weekly-progress"
                        type="line"
                        size={[112, 10]}
                        percent={Math.min(
                          100,
                          (metric.value / progressLimit) * 100
                        )}
                        showInfo={false}
                        status="normal"
                        strokeColor={metric.color}
                        railColor="#eee9f4"
                        aria-label={
                          metric.label +
                          ": " +
                          formatTime(metric.value) +
                          " de " +
                          formatTime(progressLimit) +
                          " de escala diaria" +
                          (metric.label === "Concentración"
                            ? ", referencia a las 3 horas"
                            : "")
                        }
                      />
                      {metric.label === "Concentración" &&
                        metric.value >= studyReference && (
                          <span
                            className="study-reference-marker"
                            style={{
                              bottom: `${(studyReference / progressLimit) * 100}%`
                            }}
                            aria-hidden="true"
                          />
                        )}
                      {metric.value > progressLimit && (
                        <span className="progress-overflow" aria-hidden="true">
                          +
                        </span>
                      )}
                    </span>
                  ))}
                </span>
                <span className="day-name">
                  {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][index]}
                </span>
                <span className="day-number">{Number(day.slice(-2))}</span>
                {day === localDay(now) && <span className="today-mark" />}
              </button>
            </Tooltip>
          ))}
        </div>
        <p className="weekly-intro">Reproducción y concentración, día a día.</p>
        <div className="week-navigation">
          <Button
            type="text"
            aria-label="Semana anterior"
            onClick={() => setOffset(offset - 1)}>
            ‹
          </Button>
          <span>
            {dateLabel(days[0])} – {dateLabel(days[6])}{" "}
            <small>{days[3].slice(0, 4)}</small>
          </span>
          <Button
            type="text"
            aria-label="Semana siguiente"
            disabled={offset === 0}
            onClick={() => setOffset(offset + 1)}>
            ›
          </Button>
        </div>
        <small className="chart-scale">
          Escala común: 5 h por día. La marca violeta aparece al alcanzar 3 h de
          concentración. El signo + indica tiempo por encima de la escala.
        </small>
        {!hasActivity && (
          <p className="week-empty" role="status">
            Sin actividad esta semana. Reproduce un video o comienza una sesión.
          </p>
        )}
      </section>
      <div className="hidden-summary">
        <span>
          Contenido ocultado
          <small>
            {dateLabel(days[0])} – {dateLabel(days[6])}
            {hidden &&
              firstHiddenDay &&
              firstHiddenDay > days[0] &&
              ` · Desde ${dateLabel(firstHiddenDay)}`}
          </small>
        </span>
        {hidden ? (
          <>
            <strong>{hidden.videos + hidden.shorts}</strong>
            <span>
              {hidden.videos} videos
              <br />
              {hidden.shorts} Shorts
            </span>
          </>
        ) : (
          <small>Sin registro</small>
        )}
      </div>
      <p className="statistics-note">
        YouTube suma el tiempo reproduciendo de cada pestaña, incluso en segundo
        plano. Concentración excluye pausas y descansos. Las fechas son locales.
      </p>
    </div>
  )
}
