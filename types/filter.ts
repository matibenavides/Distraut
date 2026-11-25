export type FilterType = "keyword" | "channel"

export interface Filter {
  id: string
  type: FilterType
  value: string
  enabled: boolean
  collectionId?: string
}

export interface FilterCollection {
  id: string
  name: string
  enabled: boolean
}

export interface StoredState {
  schemaVersion: 1
  enabled: boolean
  filters: Filter[]
  hideShorts?: boolean
  hideSuggested?: boolean
  statistics?: UsageStatistics
  collections?: FilterCollection[]
  session?: {
    startedAt: number
    endsAt: number
    pausedAt?: number
    breaks?: boolean
    accountedThrough?: number
  }
}

export interface UsageStatistics {
  videos: number
  shorts: number
  studyByDay: Record<string, number>
  playbackByDay?: Record<string, number>
}

export interface HiddenContent {
  kind: "videos" | "shorts"
  id: string
}

export interface VideoMetadata {
  title?: string
  channelName?: string
}
