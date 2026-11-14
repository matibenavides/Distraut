import assert from "node:assert/strict"
import { test } from "node:test"

import { createFilter, normalizeFilterValue } from "../lib/filters"
import type { Filter, FilterType, StoredState } from "../types/filter"

test("A01: crea un filtro habilitado y conserva su texto recortado", () => {
  const filter = createFilter("keyword", "  Programación  ", [])

  assert.equal(filter.type, "keyword")
  assert.equal(filter.value, "Programación")
  assert.equal(filter.enabled, true)
  assert.ok(filter.id.length > 0)
  assert.notEqual(filter.id, createFilter("keyword", "React", []).id)
})

test("A02: rechaza entradas vacías sin modificar la lista", () => {
  const existing = [createFilter("keyword", "React", [])]
  const before = structuredClone(existing)

  for (const value of ["", "   ", "\t\n", "\u0301"]) {
    assert.throws(
      () => createFilter("keyword", value, existing),
      /Escribe una palabra clave/
    )
  }

  assert.deepEqual(existing, before)
})

test("A03: rechaza duplicados sin distinguir mayúsculas, tildes o Unicode", () => {
  const existing = [createFilter("keyword", "Programación", [])]

  for (const value of [
    " programacion ",
    "PROGRAMACIÓN",
    "Programacio\u0301n"
  ]) {
    assert.throws(
      () => createFilter("keyword", value, existing),
      /Ya existe un filtro/
    )
  }
})

test("A03: un filtro desactivado también cuenta como duplicado", () => {
  const existing: Filter[] = [
    { ...createFilter("channel", "Ana Aprende", []), enabled: false }
  ]

  assert.throws(
    () => createFilter("channel", " ana aprende ", existing),
    /Ya existe un filtro/
  )
})

test("A04: permite el mismo texto en tipos distintos", () => {
  const existing = [createFilter("keyword", "React", [])]
  const filter = createFilter("channel", "React", existing)

  assert.equal(filter.type, "channel")
  assert.equal(filter.value, "React")
})

test("A05: rechaza un tipo no soportado incluso si se omite el control de tipos", () => {
  assert.throws(
    () => createFilter("video" as FilterType, "React", []),
    /El tipo de filtro/
  )
})

test("A10: crear devuelve un filtro nuevo sin cambiar el estado recibido", () => {
  const state: StoredState = {
    schemaVersion: 1,
    enabled: false,
    filters: [createFilter("keyword", "Minecraft", [])]
  }
  const before = structuredClone(state)
  const filter = createFilter("channel", "Ana Aprende", state.filters)

  assert.deepEqual(state, before)
  assert.equal(filter.enabled, true)
  assert.notEqual(filter.id, state.filters[0].id)
})

test("la normalización conserva el texto original y solo prepara la comparación", () => {
  const value = "  PROGRAMACIÓN  "

  assert.equal(normalizeFilterValue(value), "programacion")
  assert.equal(value, "  PROGRAMACIÓN  ")
})
