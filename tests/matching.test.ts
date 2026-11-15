import assert from "node:assert/strict"
import { test } from "node:test"

import { matchesFilter, shouldHideVideo } from "../lib/matching"
import type { Filter, StoredState } from "../types/filter"

const keyword: Filter = {
  id: "1",
  type: "keyword",
  value: "programacion",
  enabled: true
}
const channel: Filter = {
  id: "2",
  type: "channel",
  value: "Ana Aprende",
  enabled: true
}

test("A06: título coincide por fragmento sin distinguir tildes o mayúsculas", () => {
  assert.equal(
    matchesFilter(keyword, { title: "Programación con React" }),
    true
  )
  assert.equal(matchesFilter(keyword, { title: "Cocina con React" }), false)
})

test("A07: canal exige nombre visible completo", () => {
  assert.equal(matchesFilter(channel, { channelName: "  ÁNA APRENDE  " }), true)
  assert.equal(
    matchesFilter({ ...channel, value: "Ana" }, { channelName: "Ana Aprende" }),
    false
  )
})

test("un metadato ausente o un filtro vacío no produce coincidencias", () => {
  assert.equal(matchesFilter(keyword, { channelName: "programacion" }), false)
  assert.equal(matchesFilter(channel, { title: "Ana Aprende" }), false)
  assert.equal(
    matchesFilter({ ...keyword, value: "   " }, { title: "Cualquier video" }),
    false
  )
})

test("comparar no modifica el filtro ni los metadatos", () => {
  const video = { title: "Programación con React" }
  const before = structuredClone(video)
  matchesFilter(keyword, video)
  assert.deepEqual(video, before)
  assert.equal(keyword.value, "programacion")
})

test("A08: otra regla activa mantiene la tarjeta oculta", () => {
  const video = { title: "Programación con Ana", channelName: "Ana Aprende" }
  const state: StoredState = {
    schemaVersion: 1,
    enabled: true,
    filters: [keyword, channel]
  }

  assert.equal(shouldHideVideo(state, video), true)
  assert.equal(
    shouldHideVideo(
      { ...state, filters: [{ ...keyword, enabled: false }, channel] },
      video
    ),
    true
  )
  assert.equal(
    shouldHideVideo(
      {
        ...state,
        filters: [
          { ...keyword, enabled: false },
          { ...channel, enabled: false }
        ]
      },
      video
    ),
    false
  )
})

test("el interruptor general, lista vacía y metadatos ausentes no ocultan", () => {
  const state: StoredState = {
    schemaVersion: 1,
    enabled: true,
    filters: [keyword, channel]
  }

  assert.equal(
    shouldHideVideo({ ...state, enabled: false }, { title: "Programación" }),
    false
  )
  assert.equal(
    shouldHideVideo({ ...state, filters: [] }, { title: "Programación" }),
    false
  )
  assert.equal(shouldHideVideo(state, {}), false)
})
