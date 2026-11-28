import ScanOutlined from "@ant-design/icons/es/icons/ScanOutlined"
import { Button, Checkbox, message, Modal, Spin } from "antd"
import { useState } from "react"

import { SCAN_YOUTUBE_FEED, type FeedScan } from "../../../lib/feed-suggestions"
import {
  MAX_COLLECTION_NAME_LENGTH,
  orderedCollections
} from "../../../lib/filters"
import { saveFeedSuggestions } from "../../../lib/storage"
import type { FilterCollection } from "../../../types/filter"

export function FeedSuggestions({
  busy,
  collections
}: {
  busy: boolean
  collections?: FilterCollection[]
}) {
  const [open, setOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<FeedScan>()
  const [selected, setSelected] = useState<number[]>([])
  const [collectionId, setCollectionId] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [notice, holder] = message.useMessage()

  async function scan() {
    setOpen(true)
    setScanning(true)
    setError("")
    setResult(undefined)
    setSelected([])
    setCollectionId("")
    setName("")
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (tab?.id === undefined) throw new Error()
      const data: FeedScan | undefined = await chrome.tabs.sendMessage(
        tab.id,
        { type: SCAN_YOUTUBE_FEED },
        { frameId: 0 }
      )
      if (!data) throw new Error()
      setResult(data)
    } catch {
      setError(
        "Abre YouTube en la pestaña activa. Si ya está abierto, recarga la página y vuelve a escanear."
      )
    } finally {
      setScanning(false)
    }
  }

  const choices = result?.suggestions ?? []
  const groups = orderedCollections(collections)
  const group = groups.find(({ id }) => id === collectionId)
  const canSave =
    (collectionId ? !!group : !!name.trim()) && selected.length > 0 && !busy

  return (
    <>
      {holder}
      <Button
        size="small"
        shape="circle"
        title="Escanear filtros desde YouTube"
        aria-label="Escanear filtros desde YouTube"
        aria-haspopup="dialog"
        icon={<ScanOutlined />}
        disabled={busy || scanning}
        onClick={scan}
      />
      <Modal
        open={open}
        centered
        width={376}
        title="Escanear filtros"
        okText={collectionId ? "Añadir a colección" : "Crear colección"}
        cancelText="Cerrar"
        confirmLoading={saving}
        cancelButtonProps={{ disabled: saving }}
        okButtonProps={{ disabled: !canSave }}
        onCancel={() => {
          if (!saving) setOpen(false)
        }}
        onOk={async () => {
          if (!canSave || saving) return
          setSaving(true)
          setError("")
          try {
            const added = await saveFeedSuggestions(
              selected.map((index) => choices[index]),
              group ? { id: group.id } : { name }
            )
            setOpen(false)
            const count =
              added === 1 ? "1 filtro añadido" : `${added} filtros añadidos`
            const skipped =
              added < selected.length
                ? " Se omitieron filtros que ya estaban guardados."
                : ""
            void notice.success(
              `${count} a «${group?.name ?? name.trim()}».${skipped}`
            )
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "No se pudo crear la colección."
            )
          } finally {
            setSaving(false)
          }
        }}>
        {scanning && (
          <p role="status">
            <Spin size="small" /> Leyendo videos cargados…
          </p>
        )}
        {result && !choices.length && (
          <p role="status">
            {result.videos
              ? "No encontramos filtros nuevos en los videos cargados."
              : "No hay sugerencias. Abre Inicio de YouTube o una búsqueda con videos cargados y vuelve a escanear."}
          </p>
        )}
        {choices.length > 0 && (
          <>
            <p>
              Encontramos sugerencias en {result.videos}{" "}
              {result.videos === 1 ? "video cargado" : "videos cargados"}. Elige
              cuáles quieres ocultar.
            </p>
            <div className="feed-choices">
              {(["keyword", "channel"] as const).map((type) => {
                const group = choices
                  .map((choice, index) => ({ choice, index }))
                  .filter(({ choice }) => choice.type === type)
                if (group.length === 0) return null
                const ids = group.map(({ index }) => index)
                const allSelected = ids.every((index) =>
                  selected.includes(index)
                )
                const label =
                  type === "keyword" ? "Términos de títulos" : "Canales"
                const action = allSelected
                  ? "Desmarcar todos"
                  : "Seleccionar todos"

                return (
                  <fieldset
                    key={type}
                    disabled={saving}
                    aria-labelledby={`feed-group-${type}`}>
                    <div className="feed-group-heading">
                      <strong id={`feed-group-${type}`}>{label}</strong>
                      <Button
                        type="link"
                        size="small"
                        disabled={saving}
                        aria-label={`${action} · ${label}`}
                        onClick={() => {
                          setSelected((current) =>
                            allSelected
                              ? current.filter((index) => !ids.includes(index))
                              : [...new Set([...current, ...ids])]
                          )
                        }}>
                        {action}
                      </Button>
                    </div>
                    {group.map(({ choice, index }) => (
                      <Checkbox
                        key={index}
                        checked={selected.includes(index)}
                        onChange={(event) => {
                          const checked = event.target.checked
                          setSelected((current) =>
                            checked
                              ? [...current, index]
                              : current.filter((id) => id !== index)
                          )
                        }}>
                        {choice.value}{" "}
                        <small>
                          · {choice.count}{" "}
                          {choice.count === 1 ? "video" : "videos"}
                        </small>
                      </Checkbox>
                    ))}
                  </fieldset>
                )
              })}
            </div>
            {(groups.length > 0 || collectionId) && (
              <>
                <label htmlFor="feed-collection-destination">Guardar en</label>
                <select
                  id="feed-collection-destination"
                  value={collectionId}
                  disabled={saving}
                  onChange={(event) => {
                    setCollectionId(event.target.value)
                    setError("")
                  }}>
                  <option value="">Nueva colección</option>
                  {collectionId && !group && (
                    <option value={collectionId} disabled>
                      Colección eliminada
                    </option>
                  )}
                  {groups.map(({ id, name, enabled }) => (
                    <option key={id} value={id}>
                      {name}
                      {!enabled && " (en pausa)"}
                    </option>
                  ))}
                </select>
              </>
            )}
            {!collectionId && (
              <>
                <label htmlFor="feed-collection-name">
                  Nombre de la colección
                </label>
                <input
                  id="feed-collection-name"
                  maxLength={MAX_COLLECTION_NAME_LENGTH}
                  value={name}
                  placeholder="Ej. Distracciones"
                  disabled={saving}
                  onChange={(event) => {
                    setName(event.target.value)
                    setError("")
                  }}
                />
              </>
            )}
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </Modal>
    </>
  )
}
