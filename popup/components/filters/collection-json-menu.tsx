import SwapOutlined from "@ant-design/icons/es/icons/SwapOutlined"
import { Button, Dropdown, message, Modal } from "antd"
import { useRef, useState } from "react"

import {
  MAX_COLLECTION_JSON_BYTES,
  serializeCollectionJson
} from "../../../lib/collection-json"
import { orderedCollections } from "../../../lib/filters"
import { importCollectionJson } from "../../../lib/storage"
import type { StoredState } from "../../../types/filter"
import type { Save } from "../../types"
import { ImportCollectionList } from "./import-collection-list"

export function CollectionJsonMenu({
  state,
  busy,
  save
}: {
  state: StoredState
  busy: boolean
  save: Save
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [exportId, setExportId] = useState<string>()
  const [importingList, setImportingList] = useState(false)
  const [notice, holder] = message.useMessage()
  const groups = orderedCollections(state.collections)
  const selected = groups.find((group) => group.id === exportId)

  return (
    <>
      {holder}
      <Dropdown
        trigger={["click"]}
        disabled={busy}
        menu={{
          items: [
            { key: "list", label: "Importar lista" },
            { key: "import", label: "Importar colección" },
            {
              key: "export",
              label: "Exportar colección",
              disabled: !groups.length
            }
          ],
          onClick: ({ key }) => {
            if (key === "list") setImportingList(true)
            else if (key === "import") fileInput.current?.click()
            else setExportId(groups[0]?.id)
          }
        }}>
        <Button
          size="small"
          type="default"
          shape="circle"
          aria-label="Importar o exportar colecciones"
          aria-haspopup="menu"
          title="Importar o exportar colecciones"
          disabled={busy}
          icon={<SwapOutlined />}
        />
      </Dropdown>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Archivo JSON de colección"
        style={{ display: "none" }}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ""
          if (!file) return
          if (
            await save(async () => {
              if (file.size > MAX_COLLECTION_JSON_BYTES)
                throw new Error("El archivo supera el máximo de 1 MiB.")
              let text: string
              try {
                text = await file.text()
              } catch {
                throw new Error("No se pudo leer el archivo JSON.")
              }
              return importCollectionJson(text)
            })
          )
            void notice.success({
              key: "import-collection",
              content: "Colección importada."
            })
        }}
      />
      {importingList && (
        <ImportCollectionList
          onClose={() => setImportingList(false)}
          onImported={() => {
            setImportingList(false)
            void notice.success({
              key: "import-collection",
              content: "Colección importada."
            })
          }}
        />
      )}
      <Modal
        open={exportId !== undefined}
        title="Exportar colección"
        width={340}
        centered
        okText="Descargar archivo"
        cancelText="Cancelar"
        okButtonProps={{ disabled: !selected || busy }}
        onCancel={() => setExportId(undefined)}
        onOk={() => {
          if (!selected) return
          const blob = new Blob(
            [serializeCollectionJson(selected, state.filters)],
            { type: "application/json" }
          )
          if (blob.size > MAX_COLLECTION_JSON_BYTES) {
            void notice.error("La colección supera el máximo de 1 MiB.")
            return
          }
          const url = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = url
          link.download = `distraut-${selected.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")}.json`
          link.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
          setExportId(undefined)
        }}>
        <label htmlFor="export-collection">Colección</label>
        <select
          id="export-collection"
          value={exportId}
          onChange={(event) => setExportId(event.target.value)}>
          {!selected && (
            <option value={exportId} disabled>
              Elige una colección
            </option>
          )}
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </Modal>
    </>
  )
}
