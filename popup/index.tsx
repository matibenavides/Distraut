import { FilterOutlined } from "@ant-design/icons"
import { ConfigProvider, Tag, Typography } from "antd"

import { popupTheme } from "./theme"

import "./popup.css"

function IndexPopup() {
  return (
    <ConfigProvider theme={popupTheme}>
      <main className="popup">
        <header className="popup-header">
          <div className="brand-mark" aria-hidden="true">
            <FilterOutlined />
          </div>
          <div>
            <Typography.Title level={1} className="popup-title">
              Distraut
            </Typography.Title>
            <Typography.Text className="popup-subtitle">
              Un YouTube con menos distracciones
            </Typography.Text>
          </div>
        </header>

        <section className="popup-panel" aria-labelledby="filters-title">
          <div className="panel-heading">
            <Typography.Title level={2} id="filters-title">
              Tus filtros
            </Typography.Title>
            <Tag color="purple">MVP</Tag>
          </div>
          <p>
            Configura títulos y canales para decidir qué videos aparecen en tu
            inicio, búsqueda y relacionados.
          </p>
          <div className="coming-soon">
            <span className="coming-soon-dot" aria-hidden="true" />
            El panel de filtros estará disponible pronto.
          </div>
        </section>
      </main>
    </ConfigProvider>
  )
}

export default IndexPopup
