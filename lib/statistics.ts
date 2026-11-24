import type {
  HiddenContent,
  StoredState,
  UsageStatistics
} from "../types/filter"
import { getSessionTiming } from "./session"

export function settleStudyTime(
  state: StoredState,
  now = Date.now()
): StoredState {
  const session = state.session
  if (!session) return state
  let cursor = session.accountedThrough ?? session.startedAt
  const until = Math.min(now, session.pausedAt ?? now, session.endsAt)
  if (cursor >= until) return state
  const statistics: UsageStatistics = {
    videos: state.statistics?.videos ?? 0,
    shorts: state.statistics?.shorts ?? 0,
    studyByDay: { ...state.statistics?.studyByDay }
  }
  while (cursor < until) {
    const date = new Date(cursor)
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    const midnight = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1
    ).getTime()
    const timing = getSessionTiming(
      { ...session, pausedAt: undefined },
      cursor
    )!
    const end = Math.min(until, midnight, timing.nextBoundary)
    if (!timing.resting)
      statistics.studyByDay[day] =
        (statistics.studyByDay[day] ?? 0) + end - cursor
    cursor = end
  }
  return {
    ...state,
    statistics,
    session: { ...session, accountedThrough: until }
  }
}

export function createStatisticsRecorder(
  write: (videos: number, shorts: number) => Promise<unknown>
) {
  const seen = new Set<string>()
  return async (items: HiddenContent[]) => {
    const fresh = items.filter((item) => {
      const key = `${item.kind}:${item.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (!fresh.length) return
    try {
      await write(
        fresh.filter((item) => item.kind === "videos").length,
        fresh.filter((item) => item.kind === "shorts").length
      )
    } catch (error) {
      fresh.forEach((item) => seen.delete(`${item.kind}:${item.id}`))
      throw error
    }
  }
}
