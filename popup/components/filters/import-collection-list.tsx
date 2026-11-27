import { Button, Input, Modal } from "antd"
import { useRef, useState } from "react"

import { MAX_COLLECTION_JSON_BYTES } from "../../../lib/collection-json"
import { MAX_COLLECTION_NAME_LENGTH } from "../../../lib/filters"
import { importCollectionList } from "../../../lib/storage"
import type { FilterType } from "../../../types/filter"

export function ImportCollectionList({
  onClose,
  onImported
}: {
  onClose: () => void
  onImported: () => void
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState<FilterType>("keyword")
  const [text, setText] = useState("")
  const [fileFormat, setFileFormat] = useState<"text" | "json">()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)

  return (
    <Modal
      open
      title="Importar lista"
      width={360}
      centered
      okText="Crear colección"
      cancelText="Cancelar"
      confirmLoading={busy}
      cancelButtonProps={{ disabled: busy }}
      onCancel={() => {
        if (!busy) onClose()
      }}
      okButtonProps={{ disabled: !name.trim() || !text.trim() }}
      onOk={async () => {
        if (busy) return
        setBusy(true)
        setError("")
        try {
          await importCollectionList(name, text, type, fileFormat)
          onImported()
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "No se pudo importar la lista."
          )
        } finally {
          setBusy(false)
        }
      }}>
      <label htmlFor="import-list-name">Nombre de la colección</label>
      <input
        id="import-list-name"
        maxLength={MAX_COLLECTION_NAME_LENGTH}
        disabled={busy}
        value={name}
        placeholder="Ej. Juegos"
        onChange={(event) => {
          setName(event.target.value)
          setError("")
        }}
      />
      <label htmlFor="import-list-type">Tipo de entradas</label>
      <select
        id="import-list-type"
        disabled={busy}
        value={type}
        onChange={(event) =>
          setType(event.target.value === "channel" ? "channel" : "keyword")
        }>
        <option value="keyword">Palabras clave del título</option>
        <option value="channel">Nombres completos de canales</option>
      </select>
      <label htmlFor="import-list-text">Lista de filtros</label>
      <Input.TextArea
        id="import-list-text"
        rows={4}
        disabled={busy}
        value={text}
        placeholder="Pega una entrada por línea"
        onChange={(event) => {
          setText(event.target.value)
          setFileFormat(undefined)
          setError("")
        }}
      />
      <Button
        type="link"
        size="small"
        disabled={busy}
        onClick={() => fileInput.current?.click()}>
        Cargar archivo (.txt o .json)
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".txt,.json,text/plain,application/json"
        style={{ display: "none" }}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ""
          if (!file) return
          if (file.size > MAX_COLLECTION_JSON_BYTES) {
            setError("El archivo supera el máximo de 1 MiB.")
            return
          }
          setBusy(true)
          setError("")
          try {
            setText(await file.text())
            setFileFormat(/\.json$/i.test(file.name) ? "json" : "text")
          } catch {
            setError("No se pudo leer el archivo.")
          } finally {
            setBusy(false)
          }
        }}
      />
      <details>
        <summary>Ejemplo de JSON</summary>
        <small>
          Una lista de textos usa el tipo elegido. Para mezclar tipos, usa este
          formato.
        </small>
        <code>{'{"palabras":["deadlock"],"canales":["Riot Games"]}'}</code>
      </details>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  )
}
