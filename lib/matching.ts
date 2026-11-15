import type { Filter, VideoMetadata } from "../types/filter"
import { normalizeFilterValue } from "./filters"

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
