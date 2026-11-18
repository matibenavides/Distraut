import assert from "node:assert/strict"
import { test } from "node:test"

import { shouldHideVideo } from "../lib/matching"
import { getSessionTiming } from "../lib/session"
import type { StoredState } from "../types/filter"

test("concentración, descanso y fin comparten límites exactos", () => {
  const minute = 60000
  const session = { startedAt: 0, endsAt: 65 * minute, breaks: true }
  assert.equal(getSessionTiming(session, 29 * minute)!.remaining, minute)
  assert.equal(getSessionTiming(session, 30 * minute)!.resting, true)
  assert.equal(
    getSessionTiming(session, 30 * minute)!.nextBoundary,
    35 * minute
  )
  assert.equal(getSessionTiming(session, 35 * minute)!.resting, false)
  assert.equal(getSessionTiming(session, 64 * minute)!.remaining, minute)
  assert.equal(getSessionTiming(session, 65 * minute)!.finished, true)
  const paused = { ...session, pausedAt: 31 * minute }
  assert.deepEqual(
    getSessionTiming(paused, 40 * minute),
    getSessionTiming(paused, 100 * minute)
  )
  assert.equal(
    getSessionTiming({ startedAt: 0, endsAt: 30 * minute }, 29 * minute)!
      .remaining,
    minute
  )
})

test("una sesión pausada o en descanso restaura sin cambiar las reglas", () => {
  const now = Date.now()
  const state: StoredState = {
    schemaVersion: 1,
    enabled: true,
    filters: [{ id: "uno", type: "keyword", value: "React", enabled: true }],
    session: {
      startedAt: now - 31 * 60000,
      endsAt: now + 34 * 60000,
      breaks: true
    }
  }
  assert.equal(shouldHideVideo(state, { title: "React" }), false)
  state.session = { startedAt: now - 60000, endsAt: now + 60000, pausedAt: now }
  assert.equal(shouldHideVideo(state, { title: "React" }), false)
  delete state.session.pausedAt
  assert.equal(shouldHideVideo(state, { title: "React" }), true)
})
