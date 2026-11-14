export type FilterType = "keyword" | "channel"

export interface Filter {
  id: string
  type: FilterType
  value: string
  enabled: boolean
}

export interface StoredState {
  schemaVersion: 1
  enabled: boolean
  filters: Filter[]
}
