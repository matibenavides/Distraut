import type { PlasmoCSConfig } from "plasmo"

import { getStoredState, subscribeToStoredState } from "./lib/storage"
import { applyVideoFilters, observeVideoChanges } from "./lib/youtube-dom"
import type { StoredState } from "./types/filter"

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/*"],
  css: ["styles/youtube.css"]
}

let stateChanged = false
let currentState: StoredState | undefined
let expiryTimer: ReturnType<typeof setTimeout> | undefined

function receiveState(state: StoredState): void {
  currentState = state
  clearTimeout(expiryTimer)
  applyVideoFilters(document, state)
  if (state.session && state.session.endsAt > Date.now()) {
    expiryTimer = setTimeout(() => {
      if (currentState) applyVideoFilters(document, currentState)
    }, state.session.endsAt - Date.now())
  }
}

document.addEventListener("visibilitychange", () => {
  if (currentState) applyVideoFilters(document, currentState)
})

observeVideoChanges(document, () => {
  if (currentState) applyVideoFilters(document, currentState)
})

function reportError(error: Error): void {
  currentState = undefined
  clearTimeout(expiryTimer)
  console.error("Distraut: no se pudieron leer los filtros.", error)
  document.querySelectorAll(".distraut-hidden").forEach((card) => {
    card.classList.remove("distraut-hidden")
  })
}

subscribeToStoredState(
  (state) => {
    stateChanged = true
    receiveState(state)
  },
  (error) => {
    stateChanged = true
    reportError(error)
  }
)

getStoredState()
  .then((state) => {
    if (!stateChanged) {
      receiveState(state)
    }
  })
  .catch((error) => {
    if (!stateChanged) reportError(error)
  })
