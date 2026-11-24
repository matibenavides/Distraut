import type { PlasmoCSConfig } from "plasmo"

import { getSessionTiming } from "./lib/session"
import { createStatisticsRecorder } from "./lib/statistics"
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
const recordHidden = createStatisticsRecorder(async (videos, shorts) => {
  const result = await chrome.runtime.sendMessage({
    type: "record-hidden",
    videos,
    shorts
  })
  if (!result?.ok)
    throw new Error(result?.error || "No se pudo guardar el recuento.")
})

function applyFilters(state: StoredState): void {
  const hidden = applyVideoFilters(document, state)
  recordHidden(hidden).catch((error) =>
    console.error("Distraut: no se pudieron guardar las estadísticas.", error)
  )
}

function receiveState(state: StoredState): void {
  currentState = state
  clearTimeout(expiryTimer)
  applyFilters(state)
  const timing = getSessionTiming(state.session)
  if (timing && !timing.finished && !timing.paused) {
    expiryTimer = setTimeout(
      () => {
        if (currentState) receiveState(currentState)
      },
      Math.max(1, timing.nextBoundary - Date.now())
    )
  }
}

document.addEventListener("visibilitychange", () => {
  if (currentState) receiveState(currentState)
})

observeVideoChanges(document, () => {
  if (currentState) applyFilters(currentState)
})

function reportError(error: Error): void {
  currentState = undefined
  clearTimeout(expiryTimer)
  console.error("Distraut: no se pudieron leer los filtros.", error)
  document
    .querySelectorAll(".distraut-hidden, .distraut-shorts-hidden")
    .forEach((card) => {
      card.classList.remove("distraut-hidden", "distraut-shorts-hidden")
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
