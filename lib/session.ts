import type { StoredState } from "../types/filter"

const minute = 60000

export function getSessionTiming(
  session: StoredState["session"],
  now = Date.now()
) {
  if (!session) return undefined
  const clock = session.pausedAt ?? now
  const elapsed = Math.max(0, clock - session.startedAt)
  const duration = session.endsAt - session.startedAt
  const finished = clock >= session.endsAt
  const cycleElapsed = elapsed % (35 * minute)
  const resting = !!session.breaks && cycleElapsed >= 30 * minute && !finished
  const phaseLength = resting ? 35 * minute : 30 * minute
  const nextBoundary = session.breaks
    ? Math.min(session.endsAt, clock + phaseLength - cycleElapsed)
    : session.endsAt
  return {
    paused: session.pausedAt !== undefined,
    finished,
    resting,
    elapsed: Math.min(duration, elapsed),
    duration,
    remaining: finished ? 0 : Math.max(0, nextBoundary - clock),
    nextBoundary
  }
}
