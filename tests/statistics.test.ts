import assert from "node:assert/strict"
import { test } from "node:test"

import { createStatisticsRecorder, settleStudyTime } from "../lib/statistics"
import type { StoredState } from "../types/filter"

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
