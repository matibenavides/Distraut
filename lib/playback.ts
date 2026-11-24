// Count elapsed playback per tab; background visibility does not change this clock.
export function observePlayback(
  document: Document,
  write: (start: number, end: number) => Promise<unknown>,
  now = Date.now
) {
  const active = new Set<HTMLVideoElement>()
  let since: number | undefined
  function flush() {
    const end = now()
    if (since !== undefined && end > since) {
      const start = since
      since = end
      write(start, end).catch((error) =>
        console.error("Distraut: no se pudo guardar la reproducción.", error)
      )
    }
  }
  function receive(event: Event) {
    const video = event.target as HTMLVideoElement
    if (
      video?.tagName !== "VIDEO" ||
      !video.closest("#movie_player, ytd-shorts, ytd-reel-video-renderer")
    )
      return
    const wasPlaying = active.size > 0
    if (
      ["pause", "ended", "waiting", "emptied", "seeking", "error"].includes(
        event.type
      ) ||
      video.paused ||
      video.ended ||
      video.seeking ||
      video.readyState < 3
    )
      active.delete(video)
    else active.add(video)
    if (wasPlaying && !active.size) {
      flush()
      since = undefined
    } else if (!wasPlaying && active.size) since = now()
  }
  function stopPlayback() {
    flush()
    active.clear()
    since = undefined
  }
  const events = [
    "playing",
    "pause",
    "ended",
    "waiting",
    "emptied",
    "seeking",
    "seeked",
    "error",
    "timeupdate"
  ]
  events.forEach((type) => document.addEventListener(type, receive, true))
  document.addEventListener("yt-navigate-start", stopPlayback)
  document.defaultView?.addEventListener("pagehide", stopPlayback)
  document
    .querySelectorAll("#movie_player video, ytd-shorts video")
    .forEach((video) =>
      receive({ target: video, type: "timeupdate" } as unknown as Event)
    )
  const timer = setInterval(() => {
    flush()
    for (const video of active)
      if (!video.isConnected || video.paused || video.ended)
        active.delete(video)
    if (!active.size) since = undefined
  }, 15000)
  return () => {
    stopPlayback()
    clearInterval(timer)
    events.forEach((type) => document.removeEventListener(type, receive, true))
    document.removeEventListener("yt-navigate-start", stopPlayback)
    document.defaultView?.removeEventListener("pagehide", stopPlayback)
  }
}
