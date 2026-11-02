# 🌐 Frontend - Sistema de Planificación de Saca de Aves (Avícola GR)

Aplicación web desarrollada con **React 18**, **TypeScript**, **Vite** y **Tailwind CSS**. 

Incluye la interfaz operativa de los módulos:
* **Área Comercial:** Captura de pedidos, sugerencia en vivo y copiloto reactivo **ROXI**.
* **Gestión Comercial:** Bandeja de pedidos, fraccionamiento (*Split*), asignación de camiones, monitoreo GPS y centro de control inteligente de ROXI.
* **Área Pecuaria:** Visualización de la Tabla General de Saldo oficial de las 23 granjas en tiempo real.
* **Administración:** Gestión de roles y auditoría.

---

## 🛠 Requisitos Previos
* **Node.js:** Versión 18 o superior.
* **npm:** Versión 9 o superior.

---

## 💻 Instalación y Ejecución Local

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno locales
Copia el archivo de plantilla `.env.example`:
```bash
cp .env.example .env
```

Contenido del archivo `.env`:
```env
# URL de desarrollo local
VITE_API_URL="http://localhost:8000/api/v1"

# Conexión a Supabase
VITE_SUPABASE_URL="https://kpssroraigncmpkwxiyb.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_U3It-rjjRSSZ57UAfGBRJQ_9EefX1IV"
```

### 3. Iniciar el servidor local de desarrollo
```bash
npm run dev
```
La aplicación iniciará en `http://localhost:3000` (o `http://localhost:5173`).

---

## 🏗 Compilación para Producción

Para compilar el proyecto y verificar que no existan errores de tipos ni de empaquetado:

```bash
npm run build
```
Los archivos optimizados se generarán en la carpeta **`dist/`**.

---

## ☁️ Guía de Despliegue en Cloudflare Pages (Conectado a GitHub)

El frontend está optimizado para desplegarse de forma 100% gratuita y sin bloqueos en **Cloudflare Pages**.

### Paso 1: Subir esta carpeta `fronted/` a tu nuevo repositorio en GitHub
En tu terminal (dentro de la carpeta `fronted`):

```bash
git init
git branch -M main
git remote add origin https://github.com/<TU_USUARIO>/<TU_REPOSITORIO_FRONTEND>.git
git add .
git commit -m "feat: frontend avicola con agente ROXI y configuracion Cloudflare Pages"
git push -u origin main
```

*(El archivo `.gitignore` ya está configurado para no subir `node_modules/` ni datos sensibles).*

### Paso 2: Crear el proyecto en Cloudflare Pages
1. Inicia sesión en [dash.cloudflare.com](https://dash.cloudflare.com).
2. En el menú lateral, ve a **Workers y Pages** $\rightarrow$ **Crear aplicación** $\rightarrow$ Pestaña **Pages**.
3. Haz clic en **Conectar a Git** (Connect to Git) y selecciona tu repositorio de GitHub.
4. En la configuración de compilación (*Build settings*), verifica lo siguiente:
   * **Framework preset:** Selecciona `Vite`.
   * **Build command:** `npm run build`
   * **Build output directory:** `dist`
   * **Root directory:** `/` (déjalo vacío o con `/`).
5. En la sección **Environment variables** (Variables de entorno), agrega:

| Variable | Valor |
| :--- | :--- |
| `VITE_API_URL` | `https://avicolagr-api.carlos13soles.workers.dev/api/v1` |
| `VITE_SUPABASE_URL` | `https://kpssroraigncmpkwxiyb.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_U3It-rjjRSSZ57UAfGBRJQ_9EefX1IV` |

6. Haz clic en **Save and Deploy** (Guardar e implementar).

---

## 🔄 Soporte de Rutas SPA (Single Page Application)
Cloudflare Pages incluye en la carpeta `public/_redirects` la regla:
```text
/*    /index.html   200
```
Esto garantiza que al recargar la página en rutas internas (como `/comercial` o `/gerencia`) no se produzca ningún error 404, permitiendo que React Router gestione la navegación de forma fluida.

