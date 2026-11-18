import type { Filter, StoredState, VideoMetadata } from "../types/filter"
import { normalizeFilterValue } from "./filters"
import { getSessionTiming } from "./session"

export function matchesFilter(filter: Filter, video: VideoMetadata): boolean {
  const value = normalizeFilterValue(filter.value)
  if (!value) return false

  if (filter.type === "keyword") {
    return (
      video.title !== undefined &&
      normalizeFilterValue(video.title).includes(value)
    )
  }

  if (filter.type === "channel") {
    return (
      video.channelName !== undefined &&
      normalizeFilterValue(video.channelName) === value
    )
  }

  return false
}

export function shouldHideVideo(
  state: StoredState,
  video: VideoMetadata
): boolean {
  const timing = getSessionTiming(state.session)
  return (
    state.enabled &&
    (!timing || (!timing.finished && !timing.paused && !timing.resting)) &&
    state.filters.some(
      (filter) =>
        filter.enabled &&
        (!filter.collectionId ||
          state.collections?.some(
            (group) => group.id === filter.collectionId && group.enabled
          )) &&
        matchesFilter(filter, video)
    )
  )
}
