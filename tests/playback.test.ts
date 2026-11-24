import assert from "node:assert/strict"
import { test } from "node:test"
import { parseHTML } from "linkedom"

import { observePlayback } from "../lib/playback"

test("reproducción suma tiempo real en segundo plano, excluye espera y saltos", async () => {
  const { document, window } = parseHTML(
    '<div id="movie_player"><video></video></div><video id="preview"></video>'
  )
  const video = document.querySelector("video")!
  Object.assign(video, {
    paused: true,
    ended: false,
    seeking: false,
    readyState: 4,
    playbackRate: 2
  })
  let clock = 0
  const intervals: number[][] = []
  const stop = observePlayback(
    document,
    async (start, end) => {
      intervals.push([start, end])
    },
    () => clock
  )
  const event = (type: string) =>
    video.dispatchEvent(new window.Event(type, { bubbles: true }))
  Object.assign(video, { paused: false })
  event("playing")
  clock = 10000
  event("waiting")
  clock = 20000
  event("playing")
  clock = 25000
  Object.assign(video, { seeking: true })
  event("seeking")
  clock = 27000
  Object.assign(video, { seeking: false })
  event("seeked")
  clock = 30000
  Object.assign(video, { paused: true })
  event("pause")
  clock = 40000
  document
    .querySelector("#preview")!
    .dispatchEvent(new window.Event("playing", { bubbles: true }))
  stop()
  assert.deepEqual(intervals, [
    [0, 10000],
    [20000, 25000],
    [27000, 30000]
  ])
})
