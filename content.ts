import type { PlasmoCSConfig } from "plasmo"

import { getStoredState, subscribeToStoredState } from "./lib/storage"
import { applyVideoFilters, observeVideoChanges } from "./lib/youtube-dom"
import type { StoredState } from "./types/filter"

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/*"],
  css: ["content.css"]
}

let stateChanged = false
let currentState: StoredState | undefined

observeVideoChanges(document, () => {
  if (currentState) applyVideoFilters(document, currentState)
})

function reportError(error: Error): void {
  currentState = undefined
  console.error("Distraut: no se pudieron leer los filtros.", error)
  document.querySelectorAll(".distraut-hidden").forEach((card) => {
    card.classList.remove("distraut-hidden")
  })
}

subscribeToStoredState(
  (state) => {
    stateChanged = true
    currentState = state
    applyVideoFilters(document, state)
  },
  (error) => {
    stateChanged = true
    reportError(error)
  }
)

getStoredState()
  .then((state) => {
    if (!stateChanged) {
      currentState = state
      applyVideoFilters(document, state)
    }
  })
  .catch((error) => {
    if (!stateChanged) reportError(error)
  })
