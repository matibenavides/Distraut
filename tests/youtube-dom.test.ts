import assert from "node:assert/strict"
import { test } from "node:test"
import { parseHTML } from "linkedom"

import {
  applyVideoFilters,
  findVideoCards,
  observeVideoChanges,
  readVideoMetadata
} from "../lib/youtube-dom"
import type { StoredState } from "../types/filter"

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

const short = `<ytm-shorts-lockup-view-model-v2><ytm-shorts-lockup-view-model><a href="/shorts/abc">Short</a></ytm-shorts-lockup-view-model></ytm-shorts-lockup-view-model-v2>`

test("oculta sugeridos reversiblemente y conserva player, chat, listas y otros filtros", () => {
  const { document } = parseHTML(
    `<div id="movie_player"><video></video></div><div id="chat"></div><ytd-playlist-panel-renderer></ytd-playlist-panel-renderer><ytd-watch-next-secondary-results-renderer>${lockup("React", "Canal")}${short}</ytd-watch-next-secondary-results-renderer><ytd-search><ytd-video-renderer is-search><a id="video-title" href="/watch?v=other">React</a></ytd-video-renderer></ytd-search>`
  )
  const state: StoredState = {
    schemaVersion: 1,
    enabled: true,
    filters: [{ id: "r", type: "keyword", value: "React", enabled: true }],
    hideSuggested: true
  }
  const panel = document.querySelector(
    "ytd-watch-next-secondary-results-renderer"
  )!
  const hidden = applyVideoFilters(document, state)
  assert.equal(panel.classList.contains("distraut-suggested-hidden"), true)
  assert.equal(
    hidden.filter((item) => item.id === "abc" && item.kind === "videos").length,
    1
  )
  assert.equal(hidden.filter((item) => item.kind === "shorts").length, 1)
  for (const selector of [
    "#movie_player",
    "#chat",
    "ytd-playlist-panel-renderer",
    "ytd-search"
  ])
    assert.equal(
      document
        .querySelector(selector)!
        .classList.contains("distraut-suggested-hidden"),
      false
    )
  applyVideoFilters(document, { ...state, hideSuggested: false })
  assert.equal(panel.classList.contains("distraut-suggested-hidden"), false)
  assert.equal(
    document
      .querySelector(
        "ytd-watch-next-secondary-results-renderer yt-lockup-view-model"
      )!
      .classList.contains("distraut-hidden"),
    true
  )
  assert.equal(document.contains(panel), true)
})

test("sugeridos: concentración automática y restauración por pausa, descanso o fin respetan preferencia manual", () => {
  const { document } = parseHTML(
    `<ytd-watch-next-secondary-results-renderer>${lockup("React", "Canal")}</ytd-watch-next-secondary-results-renderer>`
  )
  const panel = document.querySelector(
    "ytd-watch-next-secondary-results-renderer"
  )!
  const now = Date.now()
  const state: StoredState = {
    schemaVersion: 1,
    enabled: false,
    filters: [],
    session: { startedAt: now - 60000, endsAt: now + 60000 }
  }
  applyVideoFilters(document, state)
  assert.equal(panel.classList.contains("distraut-suggested-hidden"), true)
  const sessions: StoredState["session"][] = [
    undefined,
    { ...state.session!, pausedAt: now },
    { startedAt: now - 31 * 60000, endsAt: now + 34 * 60000, breaks: true },
    { startedAt: now - 60000, endsAt: now - 1 }
  ]
  for (const session of sessions) {
    applyVideoFilters(document, { ...state, session })
    assert.equal(panel.classList.contains("distraut-suggested-hidden"), false)
    applyVideoFilters(document, { ...state, session, hideSuggested: true })
    assert.equal(panel.classList.contains("distraut-suggested-hidden"), true)
  }
  assert.equal(document.contains(panel), true)
})

test("sugeridos: panel tardío y navegación SPA se evalúan sin bucle por su clase", async () => {
  const { document, window } = parseHTML("<main></main>")
  let runs = 0
  const stop = observeVideoChanges(document, () => {
    runs++
    applyVideoFilters(document, {
      schemaVersion: 1,
      enabled: false,
      filters: [],
      hideSuggested: true
    })
  })
  document
    .querySelector("main")!
    .insertAdjacentHTML(
      "beforeend",
      `<ytd-watch-next-secondary-results-renderer>${lockup("React", "Canal")}</ytd-watch-next-secondary-results-renderer>`
    )
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(
    document
      .querySelector("ytd-watch-next-secondary-results-renderer")!
      .classList.contains("distraut-suggested-hidden"),
    true
  )
  assert.equal(runs, 1)
  document.dispatchEvent(new window.Event("yt-navigate-finish"))
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(runs, 2)
  stop()
})

test("métrica devuelve tarjetas individuales, sin duplicar enlaces o secciones de Shorts", () => {
  const { document } = parseHTML(
    `<ytd-search><grid-shelf-view-model>${short}${short}</grid-shelf-view-model><ytd-video-renderer is-search>${lockup("React", "Canal")}</ytd-video-renderer></ytd-search>`
  )
  const state: StoredState = {
    schemaVersion: 1,
    enabled: true,
    hideShorts: true,
    filters: [{ id: "r", type: "keyword", value: "React", enabled: true }]
  }
  assert.deepEqual(
    applyVideoFilters(document, state).sort((a, b) =>
      a.kind.localeCompare(b.kind)
    ),
    [
      { kind: "shorts", id: "abc" },
      { kind: "videos", id: "abc" }
    ]
  )
  assert.deepEqual(
    applyVideoFilters(document, {
      ...state,
      enabled: false,
      hideShorts: false
    }),
    []
  )
})

test("Shorts: secciones y tarjetas reversibles sin tocar videos, menú o reproductor", () => {
  const { document } = parseHTML(`
    <nav><a href="/shorts/">Shorts</a></nav>
    <ytd-rich-grid-renderer>
      <ytd-rich-section-renderer id="home"><ytd-rich-shelf-renderer is-shorts>${short}</ytd-rich-shelf-renderer></ytd-rich-section-renderer>
      <ytd-rich-item-renderer lockup id="normal">${lockup("React", "Canal")}</ytd-rich-item-renderer>
    </ytd-rich-grid-renderer>
    <ytd-search>
      <grid-shelf-view-model id="search">${short}</grid-shelf-view-model>
      <grid-shelf-view-model id="mixed">${short}${lockup("Python", "Canal")}</grid-shelf-view-model>
      <ytd-video-renderer is-search id="single"><a href="/shorts/xyz">Solo short</a></ytd-video-renderer>
    </ytd-search>
    <ytd-watch-next-secondary-results-renderer><ytd-reel-shelf-renderer id="related"><ytd-reel-item-renderer><a href="/shorts/def">Short</a></ytd-reel-item-renderer></ytd-reel-shelf-renderer></ytd-watch-next-secondary-results-renderer>
    <ytd-shorts id="player">${short}</ytd-shorts>
  `)
  const state: StoredState = {
    schemaVersion: 1,
    enabled: false,
    filters: [],
    hideShorts: true
  }
  const nodes = ["home", "search", "single", "related"].map(
    (id) => document.getElementById(id)!
  )
  applyVideoFilters(document, { ...state, hideShorts: undefined })
  assert.equal(document.querySelectorAll(".distraut-shorts-hidden").length, 0)
  applyVideoFilters(document, state)
  for (const node of nodes)
    assert.equal(node.classList.contains("distraut-shorts-hidden"), true)
  for (const id of ["normal", "mixed", "player"]) {
    assert.equal(
      document.getElementById(id)!.classList.contains("distraut-shorts-hidden"),
      false
    )
  }
  assert.equal(document.querySelector("#player .distraut-shorts-hidden"), null)
  assert.equal(
    document
      .querySelector("#mixed ytm-shorts-lockup-view-model-v2")!
      .classList.contains("distraut-shorts-hidden"),
    true
  )
  assert.equal(document.querySelector("nav .distraut-shorts-hidden"), null)
  applyVideoFilters(document, {
    ...state,
    hideShorts: false,
    enabled: true,
    filters: [{ id: "1", type: "keyword", value: "React", enabled: true }]
  })
  assert.equal(document.querySelectorAll(".distraut-shorts-hidden").length, 0)
  assert.equal(
    document.getElementById("normal")!.classList.contains("distraut-hidden"),
    true
  )
  for (const node of nodes) assert.equal(document.contains(node), true)
})

test("Shorts sigue oculto durante pausa, descanso y vencimiento de la sesión", () => {
  const { document } = parseHTML(`<ytd-search>${short}</ytd-search>`)
  const now = Date.now()
  for (const session of [
    { startedAt: now - 1000, endsAt: now + 10000, pausedAt: now },
    { startedAt: now - 31 * 60000, endsAt: now + 34 * 60000, breaks: true },
    { startedAt: now - 10000, endsAt: now - 1 }
  ]) {
    applyVideoFilters(document, {
      schemaVersion: 1,
      enabled: true,
      filters: [],
      hideShorts: true,
      session
    })
    assert.equal(
      document
        .querySelector("ytm-shorts-lockup-view-model-v2")!
        .classList.contains("distraut-shorts-hidden"),
      true
    )
  }
})

test("Shorts: observa nuevas tarjetas, cambios de enlace y reutilización de secciones", async () => {
  const { document, window } = parseHTML(
    `<ytd-search><grid-shelf-view-model></grid-shelf-view-model></ytd-search>`
  )
  const state: StoredState = {
    schemaVersion: 1,
    enabled: false,
    filters: [],
    hideShorts: true
  }
  let runs = 0
  const stop = observeVideoChanges(document, () => {
    runs++
    applyVideoFilters(document, state)
  })
  const shelf = document.querySelector("grid-shelf-view-model")!
  shelf.insertAdjacentHTML("beforeend", short)
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(shelf.classList.contains("distraut-shorts-hidden"), true)
  assert.equal(runs, 1)
  shelf.querySelector("a")!.setAttribute("href", "/watch?v=abc")
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(document.querySelectorAll(".distraut-shorts-hidden").length, 0)
  shelf.querySelector("a")!.setAttribute("href", "/shorts/abc")
  document.dispatchEvent(new window.Event("yt-navigate-finish"))
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(shelf.classList.contains("distraut-shorts-hidden"), true)
  assert.equal(runs, 3)
  stop()
})

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

test("relacionados: conserva tarjetas incompletas para poder restaurarlas", () => {
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
  assert.equal(cards.length, 3)
  assert.deepEqual(readVideoMetadata(cards[0]), {
    title: "¿SQL o NoSQL?",
    channelName: "EDteam"
  })
  assert.deepEqual(readVideoMetadata(cards[1]), {
    title: "Solo título",
    channelName: undefined
  })
  assert.deepEqual(readVideoMetadata(cards[2]), {
    title: undefined,
    channelName: undefined
  })
})

test("oculta y restaura el mismo nodo según filtros y metadatos actuales", () => {
  const { document } = parseHTML(`
    <ytd-rich-grid-renderer>
      <ytd-rich-item-renderer lockup>${lockup("Programación con React", "Ána Aprende")}</ytd-rich-item-renderer>
    </ytd-rich-grid-renderer>
  `)
  const card = findVideoCards(document)[0]
  const state: StoredState = {
    schemaVersion: 1,
    enabled: true,
    filters: [
      { id: "1", type: "keyword", value: "programacion", enabled: true }
    ]
  }

  applyVideoFilters(document, state)
  assert.equal(card.classList.contains("distraut-hidden"), true)
  assert.equal(document.contains(card), true)

  applyVideoFilters(document, { ...state, enabled: false })
  assert.equal(card.classList.contains("distraut-hidden"), false)

  applyVideoFilters(document, state)
  card.querySelector("h3")?.setAttribute("title", "Cocina con React")
  applyVideoFilters(document, state)
  assert.equal(card.classList.contains("distraut-hidden"), false)

  card.querySelector('a[href^="/watch?v="]')?.removeAttribute("href")
  card.querySelector("h3")?.setAttribute("title", "Programación con React")
  applyVideoFilters(document, state)
  assert.equal(card.classList.contains("distraut-hidden"), false)
})

test("procesa tarjetas nuevas y modificadas en una sola tanda", async () => {
  const { document, window } = parseHTML(`
    <ytd-rich-grid-renderer></ytd-rich-grid-renderer>
    <nav></nav>
  `)
  const state: StoredState = {
    schemaVersion: 1,
    enabled: true,
    filters: [{ id: "1", type: "keyword", value: "react", enabled: true }]
  }
  let runs = 0
  const stop = observeVideoChanges(document, () => {
    runs++
    applyVideoFilters(document, state)
  })
  const grid = document.querySelector("ytd-rich-grid-renderer")!
  grid.insertAdjacentHTML(
    "beforeend",
    `<ytd-rich-item-renderer lockup>${lockup("React básico", "Ana")}</ytd-rich-item-renderer>`
  )
  grid.insertAdjacentHTML(
    "beforeend",
    `<ytd-rich-item-renderer lockup>${lockup("Python básico", "Ana")}</ytd-rich-item-renderer>`
  )
  await new Promise((resolve) => setTimeout(resolve, 10))
  const cards = findVideoCards(document)
  assert.equal(runs, 1)
  assert.equal(cards[0].classList.contains("distraut-hidden"), true)
  assert.equal(cards[1].classList.contains("distraut-hidden"), false)

  cards[0].querySelector("h3")?.setAttribute("title", "Python avanzado")
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(runs, 2)
  assert.equal(cards[0].classList.contains("distraut-hidden"), false)

  document.querySelector("nav")?.setAttribute("title", "Sin relación")
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(runs, 2)

  document.dispatchEvent(new window.Event("yt-navigate-finish"))
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(runs, 3)
  stop()
})
