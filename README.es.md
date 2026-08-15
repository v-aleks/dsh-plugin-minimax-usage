# 📊 MiniMax Monitor de Cuota

> Un plugin para [DeepSeek Harness](https://github.com/deepseek-ai/dsh) que muestra el uso de tu cuota de MiniMax Coding Plan directamente en la barra lateral.

[![DeepSeek Harness Plugin](https://img.shields.io/badge/DeepSeek-Harness%20Plugin-blue?style=flat-square&logo=deepseek)](https://github.com/deepseek-ai/dsh)
[![DSH Client Plugin](https://img.shields.io/badge/dsh--plugin-client-4d86f8?style=flat-square)](https://github.com/deepseek-ai/dsh)
[![npm compatible](https://img.shields.io/badge/npm-compatible-green?style=flat-square&logo=npm)](https://www.npmjs.com/)
[![MIT License](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](./LICENSE)

**[English](./README.md)** · **[中文](./README.zh-CN.md)** · **[日本語](./README.ja.md)** · **Español**

---

## ✨ Características

- **Barra de cuota de 5 horas** — progreso en tiempo real de tu intervalo actual restante
- **Barra de cuota semanal** — uso semanal del límite de un vistazo
- **Cuenta regresiva de reinicio** — muestra exactamente cuándo se reinicia cada ventana (ej. `重置于 2h 17m`)
- **Actualización automática** — se actualiza cada 60 segundos mediante caché del lado del servidor
- **Integración en la barra lateral** — se renderiza en `sidebar.footer.action`, justo encima del botón de Ajustes
- **Implementación ligera** — React.createElement puro, sin frameworks CSS, sin imágenes externas

## 📸 Vista previa

```
┌──────────────────────────────┐
│  MINIMAX                     │
│  5 小時   42 / 100 (42%)     │
│  ████████████░░░░░░░░░░░░░░  │
│  重置于 2h 17m                │
│                              │
│  本周     78 / 100 (78%)     │
│  ████████████████████████░░  │
│  重置于 3d 12h               │
└──────────────────────────────┘
```

## 🚀 Instalación

### Instalación rápida (recomendada)

```bash
cd ~/.dsh/profiles/web
npm link /path/to/this/plugin
# luego agrega la entrada de parche (ver más abajo)
```

### Usando pnpm

```bash
cd ~/.dsh/profiles/web
pnpm add /path/to/this/plugin
```

### Vía registro npm (cuando esté publicado)

```bash
cd ~/.dsh/profiles/web
pnpm add @dsh-external/minimax-usage
```

### 1. Agregar a cordis.patch.yml

Añade esto al final de `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: minimax-usage
      name: '@dsh-external/minimax-usage'
```

### 2. Configurar tu clave API

El plugin lee `MINIMAX_API_KEY` desde `~/.zshrc.secret` (o tu archivo de secretos del shell):

```bash
# En ~/.zshrc.secret o ~/.bashrc.secret
export MINIMAX_API_KEY="tu-clave-api-de-minimax"
```

Obtén tu clave API en [MiniMax Open Platform](https://www.minimaxi.com/).

### 3. Reiniciar y actualizar

```bash
# Reiniciar el servidor web de DSH
dsh web
# Actualización forzada del navegador (Cmd+Shift+R / Ctrl+Shift+R)
```

## ⚙️ Configuración

| Variable de entorno | Descripción | Valor por defecto |
|---|---|---|
| `MINIMAX_API_KEY` | Tu clave API de MiniMax | *(obligatorio)* |

La clave API se carga dinámicamente en cada solicitud mediante `source ~/.zshrc.secret`. Si la clave no está configurada, el plugin mostrará un mensaje de error en la barra lateral en lugar de fallar.

## 🏗️ Arquitectura

```
┌─────────────────────────────────┐
│  Host (Node.js)                 │
│  lib/index.js                   │
│  ├─ registra /api/minimax/quota │
│  ├─ lee MINIMAX_API_KEY         │
│  ├─ llama a la API REST MiniMax │
│  └─ caché del servidor 60s      │
└──────────┬──────────────────────┘
           │ fetch('/api/minimax/quota')
           ▼
┌─────────────────────────────────┐
│  Cliente (Navegador)            │
│  lib/client.js                  │
│  ├─ Slot: sidebar.footer.action │
│  ├─ Componente QuotaCard React  │
│  └─ auto-actualización 60s      │
└─────────────────────────────────┘
```

## 🤝 Contribuir

1. Haz Fork de este repositorio
2. Crea tu rama de funcionalidad (`git checkout -b feature/amazing-feature`)
3. Confirma tus cambios (`git commit -m 'Add amazing feature'`)
4. Envía a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## 📝 Notas técnicas

- Los campos `remains_time` / `weekly_remains_time` de la API de MiniMax no son fiables (pueden devolver ~96 días para una ventana de 5 horas). Este plugin calcula las cuentas regresivas de reinicio a partir de `end_time - Date.now()`, lo cual es preciso.
- Los campos `end_time`, `start_time`, `weekly_end_time` y `weekly_start_time` son **marcas de tiempo Unix en milissegundos**, a pesar de lo que sugieren los nombres de los campos.
- Los porcentajes de cuota son devueltos por la API como enteros de 0 a 100.

## 📋 Manifiesto de Plugin DSH

Este plugin está diseñado para **DeepSeek Harness** y sigue el formato de plugin npm-package de DSH:

- **`dsh.bundle.patch`** — archivo de parche Cordis para registro automático
- **`dsh.client.inject`** — sin dependencias de servicios externos
- **`dsh.client.platform`** — `web` (cliente solo para navegador)
- **Slot** — `sidebar.footer.action`

### Etiquetas / Palabras clave

`deepseek-harness` · `dsh` · `dsh-plugin` · `dsh-client-plugin` · `minimax` · `quota` · `usage-monitor` · `sidebar` · `coding-plan`

## 📜 Licencia

[MIT](./LICENSE) © 2026 ovensi

---

<p align="center">
  Construido para <a href="https://github.com/deepseek-ai/dsh">DeepSeek Harness</a> 🚀
</p>
