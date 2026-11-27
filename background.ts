import {
  initializeHiddenCounts,
  recordHiddenCounts,
  recordPlayback
} from "./lib/storage"

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install" || reason === "update") {
    void initializeHiddenCounts().catch((error) =>
      console.error("Distraut: no se pudo iniciar el recuento semanal.", error)
    )
  }
})

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "record-hidden" && message?.type !== "record-playback")
    return
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith("https://www.youtube.com/")
  ) {
    respond({ ok: false, error: "Origen no permitido." })
    return
  }
  const operation =
    message.type === "record-playback"
      ? recordPlayback(message.start, message.end)
      : recordHiddenCounts(message.videos, message.shorts)
  operation.then(
    () => respond({ ok: true }),
    (error) =>
      respond({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el recuento."
      })
  )
  return true
})
