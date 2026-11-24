import assert from "node:assert/strict"
import { test } from "node:test"

import {
  addPlaybackInterval,
  createStatisticsRecorder,
  settleStudyTime,
  weekDays
} from "../lib/statistics"
import type { StoredState } from "../types/filter"

test("reproducción cruza medianoche y se conserva al consolidar concentración", () => {
  const start = new Date(2026, 10, 24, 23, 59).getTime()
  const days = addPlaybackInterval({}, start, start + 120000)
  assert.deepEqual(days, { "2026-11-24": 60000, "2026-11-25": 60000 })
  const state: StoredState = {
    schemaVersion: 1,
    enabled: true,
    filters: [],
    statistics: { videos: 0, shorts: 0, studyByDay: {}, playbackByDay: days },
    session: { startedAt: start, endsAt: start + 120000 }
  }
  assert.deepEqual(
    settleStudyTime(state, start + 120000).statistics?.playbackByDay,
    days
  )
})

test("semana empieza lunes y acaba domingo, incluidos cambios de año y domingo", () => {
  const sunday = new Date(2027, 0, 3, 23, 30).getTime()
  assert.deepEqual(weekDays(sunday), [
    "2026-12-28",
    "2026-12-29",
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
    "2027-01-03"
  ])
  assert.equal(weekDays(sunday, -1)[0], "2026-12-21")
  assert.equal(weekDays(new Date(2027, 0, 4).getTime())[0], "2027-01-04")
})

test("cuenta una vez por ID/tipo, incluso con escrituras en curso; reintenta errores", async () => {
  const writes: number[][] = []
  let fail = false
  const record = createStatisticsRecorder(async (v, s) => {
    if (fail) throw Error("cuota")
    writes.push([v, s])
  })
  const item = { kind: "shorts" as const, id: "abc" }
  await Promise.all([record([item, item]), record([item])])
  assert.deepEqual(writes, [[0, 1]])
  await record([{ ...item, kind: "videos" }])
  fail = true
  await assert.rejects(record([{ ...item, id: "retry" }]), /cuota/)
  fail = false
  await record([{ ...item, id: "retry" }])
  assert.deepEqual(writes, [
    [0, 1],
    [1, 0],
    [0, 1]
  ])
})

test("reparte concentración entre fechas, excluye descanso y no consolida dos veces", () => {
  const start = new Date(2026, 10, 24, 23, 50).getTime()
  const state: StoredState = {
    schemaVersion: 1,
    enabled: true,
    filters: [],
    session: { startedAt: start, endsAt: start + 65 * 60000, breaks: true }
  }
  const settled = settleStudyTime(state, start + 70 * 60000)
  assert.deepEqual(settled.statistics?.studyByDay, {
    "2026-11-24": 10 * 60000,
    "2026-11-25": 50 * 60000
  })
  assert.deepEqual(settleStudyTime(settled, start + 80 * 60000), settled)
  assert.equal(state.statistics, undefined)
  const paused = settleStudyTime(
    { ...state, session: { ...state.session!, pausedAt: start + 12 * 60000 } },
    start + 60 * 60000
  )
  assert.deepEqual(paused.statistics?.studyByDay, {
    "2026-11-24": 10 * 60000,
    "2026-11-25": 2 * 60000
  })
})
