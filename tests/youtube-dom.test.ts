import assert from "node:assert/strict"
import { test } from "node:test"
import { parseHTML } from "linkedom"

import { findVideoCards, readVideoMetadata } from "../lib/youtube-dom"

const lockup = (title: string, channel: string) => `
  <yt-lockup-view-model>
    <h3 class="ytLockupMetadataViewModelHeadingReset" title="${title}">
      <a class="ytLockupMetadataViewModelTitle" href="/watch?v=abc">${title}</a>
    </h3>
    <div class="ytContentMetadataViewModelMetadataRow">
      <span class="ytContentMetadataViewModelMetadataText">${channel}</span>
      <span class="ytContentMetadataViewModelMetadataText">46 K</span>
    </div>
  </yt-lockup-view-model>
`

test("inicio: extrae título y canal del video, sin incluir Shorts", () => {
  const { document } = parseHTML(`
    <ytd-rich-grid-renderer>
      <ytd-rich-item-renderer lockup>${lockup("Programación con React", "Ána Aprende")}</ytd-rich-item-renderer>
      <ytd-rich-section-renderer><ytd-reel-item-renderer><a href="/shorts/xyz">Short</a></ytd-reel-item-renderer></ytd-rich-section-renderer>
    </ytd-rich-grid-renderer>
  `)

  const cards = findVideoCards(document)
  assert.equal(cards.length, 1)
  assert.deepEqual(readVideoMetadata(cards[0]), {
    title: "Programación con React",
    channelName: "Ána Aprende"
  })
})

test("búsqueda: distingue videos de listas y lee el nombre del canal", () => {
  const { document } = parseHTML(`
    <ytd-search>
      ${lockup("Lista de React", "Autor de lista")}
      <ytd-video-renderer is-search>
        <a id="video-title" title="¿Qué es React?" href="/watch?v=def">¿Qué es React?</a>
        <ytd-channel-name><a href="/@EDteam">EDteam</a></ytd-channel-name>
      </ytd-video-renderer>
    </ytd-search>
  `)

  const cards = findVideoCards(document)
  assert.equal(cards.length, 1)
  assert.deepEqual(readVideoMetadata(cards[0]), {
    title: "¿Qué es React?",
    channelName: "EDteam"
  })
})

test("relacionados: acepta título sin canal y descarta tarjetas incompletas", () => {
  const { document } = parseHTML(`
    <ytd-watch-next-secondary-results-renderer>
      ${lockup("¿SQL o NoSQL?", "EDteam")}
      <yt-lockup-view-model>
        <h3 class="ytLockupMetadataViewModelHeadingReset" title="Solo título"></h3>
        <a href="/watch?v=ghi">Video</a>
      </yt-lockup-view-model>
      <yt-lockup-view-model><a href="/watch?v=jkl">Sin título</a></yt-lockup-view-model>
    </ytd-watch-next-secondary-results-renderer>
  `)

  const cards = findVideoCards(document)
  assert.equal(cards.length, 2)
  assert.deepEqual(readVideoMetadata(cards[0]), {
    title: "¿SQL o NoSQL?",
    channelName: "EDteam"
  })
  assert.deepEqual(readVideoMetadata(cards[1]), {
    title: "Solo título",
    channelName: undefined
  })
})
