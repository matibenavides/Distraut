import { recordHiddenCounts } from "./lib/storage"

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "record-hidden") return
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith("https://www.youtube.com/")
  ) {
    respond({ ok: false, error: "Origen no permitido." })
    return
  }
  recordHiddenCounts(message.videos, message.shorts).then(
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
