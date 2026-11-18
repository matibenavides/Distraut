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
  collections?: FilterCollection[]
  session?: {
    startedAt: number
    endsAt: number
    pausedAt?: number
    breaks?: boolean
  }
}

export interface VideoMetadata {
  title?: string
  channelName?: string
}
