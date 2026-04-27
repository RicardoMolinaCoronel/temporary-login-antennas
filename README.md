# SINPRO Console

Aplicación de escritorio **Electron** para gestionar y conectarse a antenas RFID por empresa. Permite iniciar sesión con credenciales vinculadas a una empresa, seleccionar localidad y antena, visualizar su estado de conectividad en tiempo real, y acceder a la interfaz web de cada antena directamente desde la app (sin exponer la URL).

---

## Requisitos

| Herramienta | Versión mínima |
|---|---|
| [Node.js](https://nodejs.org/) | 18 LTS o superior |
| npm | 9+ (incluido con Node.js) |
| Windows | 10 x64 (para el ejecutable) |

---

## Instalación

```bash
git clone <url-del-repo>
cd temporary-login-antennas
npm install
```

---

## Desarrollo

Inicia la app en modo desarrollo (con DevTools disponibles):

```bash
npm start
```

Para activar la variable de entorno de desarrollo:

```bash
npm run start:dev
```

---

## Generar ejecutable (Windows x64)

```bash
npm run build
```

El script hace automáticamente:
1. Convierte `src/renderer/SINPRO_ONLY_LOGO.png` → `build/icon.ico`
2. Empaqueta la app con **electron-packager**

La salida queda en:

```
dist/
└── SINPRO Console-win32-x64/
    ├── SINPRO Console.exe   ← ejecutable principal
    └── resources/
        ├── app.asar         ← código (no editar)
        ├── config/
        │   └── antennas.json  ← ⚡ editable sin recompilar
        └── assets/
            └── *.png / *.jpeg ← logos de empresa
```

> Para distribuir la app, comprime o copia toda la carpeta `SINPRO Console-win32-x64/`.  
> No es necesario instalar Node.js en la máquina de destino.

---

## Estructura del proyecto

```
src/
├── main.js              # Proceso principal de Electron (IPC, ventanas, auth)
├── preload.js           # Bridge seguro entre main y renderer
├── config/
│   └── antennas.json    # Configuración: empresas, usuarios, localidades, antenas
├── assets/              # Logos de empresa
└── renderer/
    ├── login.html       # Ventana de inicio de sesión
    ├── main.html        # Ventana principal (header + BrowserView)
    ├── antennas-view.html  # Vista de estado de antenas (ONLINE / OFFLINE)
    └── renderer.js      # (legacy, no usado actualmente)

scripts/
└── build.js             # Script de empaquetado con conversión de icono

build/
└── icon.ico             # Generado automáticamente por npm run build
```

---

## Configuración (`src/config/antennas.json`)

El archivo JSON controla toda la información de empresas, usuarios y antenas. Se puede editar directamente en la carpeta del ejecutable sin necesidad de recompilar.

### Estructura

```json
{
  "companies": [
    {
      "id": "c1",
      "name": "Nombre de la empresa",
      "image_path": "./assets/logo.png"
    }
  ],
  "localities": [
    { "id": "l1", "name": "Sucursal Centro", "company_id": "c1" }
  ],
  "antennas": [
    {
      "id": "a1",
      "name": "Puerta 1, ANTENA RX1",
      "ip": "192.168.1.100",
      "url": "http://192.168.1.100",
      "locality_id": "l1"
    }
  ],
  "users": [
    {
      "id": "u1",
      "username": "operador",
      "name": "Nombre Completo",
      "company_id": "c1",
      "password": "secreto"
    }
  ],
  "allowedOrigins": [
    "https://sitio-adicional.com"
  ]
}
```

### Notas

- Cada `antenna` pertenece a una `locality` (vía `locality_id`).
- Cada `locality` pertenece a una `company` (vía `company_id`).
- Cada `user` está asociado a una `company`. Al iniciar sesión, los dropdowns muestran solo las localidades y antenas de esa empresa.
- `image_path` puede ser relativo a la carpeta `resources/` del ejecutable o una ruta absoluta del sistema.
- Las URLs de las antenas están **permitidas automáticamente**; no hace falta duplicarlas en `allowedOrigins`. Solo agrega allí otros orígenes adicionales.
- Las contraseñas están en texto plano — se recomienda proteger el acceso al archivo de configuración en entornos de producción.

---

## Funcionalidades

| Pantalla | Descripción |
|---|---|
| **Login** | Autenticación por usuario/contraseña. Muestra las opciones filtradas por empresa |
| **Main** | Header con empresa, usuario, selects de localidad/antena y acceso a la interfaz web de la antena mediante BrowserView embebido |
| **Ver Antenas** | Lista todas las antenas de la empresa con su localidad, IP y estado **ONLINE / OFFLINE** (verificación TCP). Auto-refresco cada 30 s |
| **Menú ⋯** | Dropdown desde la esquina del header: acceso rápido a "Ver Antenas" y "Cerrar sesión" |

---

## Dependencias principales

| Paquete | Rol |
|---|---|
| `electron` | Framework de escritorio |
| `electron-packager` | Empaquetado para Windows/macOS/Linux |
| `png-to-ico` | Conversión del logo PNG → ICO para el exe |
| `jimp` | Redimensionado de imagen antes de la conversión |
