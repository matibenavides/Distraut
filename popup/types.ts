import type { StoredState } from "../types/filter"

export type Save = (operation: () => Promise<StoredState>) => Promise<boolean>
