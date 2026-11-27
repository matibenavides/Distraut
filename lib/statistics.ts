import type {
  HiddenContent,
  HiddenCounts,
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
    ...state.statistics,
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

export function localDay(time: number): string {
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function addPlaybackInterval(
  days: Record<string, number>,
  start: number,
  end: number
) {
  const result = { ...days }
  while (start < end) {
    const date = new Date(start)
    const next = Math.min(
      end,
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1
      ).getTime()
    )
    const day = localDay(start)
    const value = (result[day] ?? 0) + next - start
    if (!Number.isSafeInteger(value))
      throw new Error("Tiempo de reproducción fuera de rango.")
    result[day] = value
    start = next
  }
  return result
}

export function weekDays(anchor: number, offset = 0): string[] {
  const date = new Date(anchor)
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + offset * 7)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date)
    day.setDate(date.getDate() + index)
    return localDay(day.getTime())
  })
}

export function weeklyHiddenCounts(
  statistics: UsageStatistics,
  days: readonly string[]
): HiddenCounts | undefined {
  const hidden = statistics.hidden
  if (!hidden || days[6] < hidden.firstDay) return undefined
  return hidden.byWeek[days[0]] ?? { videos: 0, shorts: 0 }
}

export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
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
