import ScanOutlined from "@ant-design/icons/es/icons/ScanOutlined"
import { Button, Checkbox, message, Modal, Spin } from "antd"
import { useState } from "react"

import { SCAN_YOUTUBE_FEED, type FeedScan } from "../../../lib/feed-suggestions"
import { MAX_COLLECTION_NAME_LENGTH } from "../../../lib/filters"
import { saveCollectionDraft } from "../../../lib/storage"

export function FeedSuggestions({ busy }: { busy: boolean }) {
  const [open, setOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<FeedScan>()
  const [selected, setSelected] = useState<number[]>([])
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [notice, holder] = message.useMessage()

  async function scan() {
    setOpen(true)
    setScanning(true)
    setError("")
    setResult(undefined)
    setSelected([])
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
        okText="Crear colección"
        cancelText="Cerrar"
        confirmLoading={saving}
        cancelButtonProps={{ disabled: saving }}
        okButtonProps={{
          disabled: !name.trim() || selected.length === 0 || busy
        }}
        onCancel={() => {
          if (!saving) setOpen(false)
        }}
        onOk={async () => {
          if (!name.trim() || !selected.length || saving || busy) return
          setSaving(true)
          setError("")
          try {
            await saveCollectionDraft({
              name,
              filters: selected.map((index) => ({
                type: choices[index].type,
                value: choices[index].value,
                enabled: true
              }))
            })
            setOpen(false)
            void notice.success("Colección creada.")
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
            No hay sugerencias. Abre Inicio de YouTube o una búsqueda con videos
            cargados y vuelve a escanear.
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
              {(["keyword", "channel"] as const).map(
                (type) =>
                  choices.some((choice) => choice.type === type) && (
                    <fieldset key={type} disabled={saving}>
                      <legend>
                        {type === "keyword" ? "Términos de títulos" : "Canales"}
                      </legend>
                      {choices.map(
                        (choice, index) =>
                          choice.type === type && (
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
                          )
                      )}
                    </fieldset>
                  )
              )}
            </div>
            <label htmlFor="feed-collection-name">Nombre de la colección</label>
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
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </Modal>
    </>
  )
}
