import type { PlasmoCSConfig } from "plasmo"

import { getStoredState, subscribeToStoredState } from "./lib/storage"
import { applyVideoFilters } from "./lib/youtube-dom"

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/*"],
  css: ["content.css"]
}

let stateChanged = false

function reportError(error: Error): void {
  console.error("Distraut: no se pudieron leer los filtros.", error)
  document.querySelectorAll(".distraut-hidden").forEach((card) => {
    card.classList.remove("distraut-hidden")
  })
}

subscribeToStoredState(
  (state) => {
    stateChanged = true
    applyVideoFilters(document, state)
  },
  (error) => {
    stateChanged = true
    reportError(error)
  }
)

getStoredState()
  .then((state) => {
    if (!stateChanged) applyVideoFilters(document, state)
  })
  .catch((error) => {
    if (!stateChanged) reportError(error)
  })
