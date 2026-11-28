import SwapOutlined from "@ant-design/icons/es/icons/SwapOutlined"
import { Button, Dropdown, message, Modal } from "antd"
import { useRef, useState } from "react"

import {
  MAX_COLLECTION_JSON_BYTES,
  serializeCollectionJson,
  serializeCollectionsJson
} from "../../../lib/collection-json"
import { orderedCollections } from "../../../lib/filters"
import { importCollectionJson } from "../../../lib/storage"
import type { StoredState } from "../../../types/filter"
import type { Save } from "../../types"

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
  const [notice, holder] = message.useMessage()
  const collections = state.collections ?? []
  const groups = orderedCollections(collections)
  const selected = exportId
    ? groups.find((group) => group.id === exportId)
    : undefined
  const exportAll = exportId === ""
  const canExport = groups.length > 0 && (exportAll || !!selected)

  return (
    <>
      {holder}
      <Dropdown
        trigger={["click"]}
        disabled={busy}
        menu={{
          items: [
            { key: "import", label: "Importar colecciones" },
            {
              key: "export",
              label: "Exportar colecciones",
              disabled: !groups.length
            }
          ],
          onClick: ({ key }) => {
            if (key === "import") fileInput.current?.click()
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
        aria-label="Archivo JSON de colecciones"
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
              content: "Archivo importado."
            })
        }}
      />
      <Modal
        open={exportId !== undefined}
        title="Exportar colecciones"
        width={340}
        centered
        okText="Descargar archivo"
        cancelText="Cancelar"
        okButtonProps={{ disabled: !canExport || busy }}
        onCancel={() => setExportId(undefined)}
        onOk={() => {
          if (!canExport || busy) return
          const json = selected
            ? serializeCollectionJson(selected, state.filters)
            : serializeCollectionsJson(collections, state.filters)
          const blob = new Blob([json], { type: "application/json" })
          if (blob.size > MAX_COLLECTION_JSON_BYTES) {
            void notice.error("El archivo supera el máximo de 1 MiB.")
            return
          }
          const url = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = url
          const name =
            selected?.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-") ??
            "colecciones"
          link.download = `distraut-${name}.json`
          link.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
          setExportId(undefined)
        }}>
        <label htmlFor="export-collection">Qué exportar</label>
        <select
          id="export-collection"
          value={exportId}
          onChange={(event) => setExportId(event.target.value)}>
          {!selected && !exportAll && (
            <option value={exportId} disabled>
              Elige una colección
            </option>
          )}
          <option value="">Todas las colecciones ({groups.length})</option>
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
