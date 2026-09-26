# AutoSubasta GT — Subastas de vehículos en tiempo real (caso Copart)

## 🌐 Sitio publicado: **_(pendiente de publicación)_**

Plataforma desacoplada **Frontend (React SPA) + Web API REST (Node.js/Express) + Base de datos (SQL Server)**
con **tiempo real vía WebSockets (Socket.IO)**. Los usuarios se registran, publican vehículos con ficha técnica,
clasificación de daño y galería, y ofertan en subastas en vivo sin recargar la página.

> Examen 2do. Parcial — Desarrollo y Diseño Web (036) · Universidad Mariano Gálvez de Guatemala
> Estudiante: **Esaú Abimael de la Cruz Mendoza** · Carné **1890-21-13279**

---

## 🔑 Usuarios de prueba

Para probar pujas cruzadas en tiempo real, abrir el sitio en **3 navegadores distintos** (o ventanas de incógnito) e iniciar sesión con un usuario en cada uno:

| Usuario | Correo | Contraseña |
| --- | --- | --- |
| Ana López | `ana@subastas.test` | `Prueba#2026` |
| Bruno Pérez | `bruno@subastas.test` | `Prueba#2026` |
| Carla Méndez | `carla@subastas.test` | `Prueba#2026` |

Los usuarios se crean automáticamente al iniciar el servidor. También se puede crear una cuenta nueva en **Regístrese**.

---

## ✅ Cumplimiento de la rúbrica

| Serie | Requisito | Implementación |
| --- | --- | --- |
| **I** | Git y publicación | Repositorio público, sitio desplegado en Render, link y 3 usuarios en este README. |
| **I** | Autenticación | Registro (nombre, apellido, correo, teléfono, contraseña segura) y login con **JWT**. Contraseñas con **bcrypt**. Anónimos solo ven el inventario y el detalle en **modo lectura**; publicar, editar y ofertar exigen sesión (validado en el servidor). |
| **II** | Vehículo y galería | Ficha técnica completa (año, tipo, marca, modelo, motor, transmisión, combustible, tren AWD/FWD/RWD/4WD, cilindros), daño 🟢🟡🔴 y **mínimo 5 fotos** (validado en servidor). Carrusel interactivo con flechas, miniaturas y teclado. |
| **II** | Catálogo y filtros | Home con *cards* y **filtros combinables**: búsqueda libre, daño, estado, marca, modelo, rango de años, tipo, combustible, transmisión, tren, cilindros + ordenamiento. |
| **II** | Edición | "Mis publicaciones" con buscador; solo el publicador puede editar (validado en servidor). Si ya hay ofertas no se puede bajar el monto base ni mover el inicio. |
| **III** | Tiempo real | Socket.IO: la oferta actual, el historial, el temporizador y los indicadores **"¡Vas ganando!" / "Tu oferta ha sido superada"** se actualizan en vivo **sin F5**. Los postores son **anónimos**: el cliente nunca recibe identidades. |
| **III** | Reglas de puja | Validadas **en el servidor** dentro de una transacción con bloqueo: oferta ≥ monto base, ≥ oferta actual **+10 %**, dentro de la ventana inicio/cierre, sin ofertar en lo propio. Al vencer el tiempo: **"Oferta cerrada"**, y la subasta queda **VENDIDA** o **DESIERTA** (sin ofertas ≥ base). |

---

## 🏗️ Arquitectura

```
┌──────────────────────────┐   HTTPS (REST + JWT)    ┌──────────────────────────────┐   TDS/TLS   ┌──────────────────────┐
│  React SPA (Vite)        │ ──────────────────────▶ │  Express (Web API REST)      │ ──────────▶ │  SQL Server          │
│  - react-router          │                         │  - routes → services → db    │             │  edelacruz_Usuarios  │
│  - Context de sesión     │ ◀────────────────────── │  - helmet, rate-limit        │             │  edelacruz_Catalogos │
│  - socket.io-client      │   WebSocket (Socket.IO) │  - Socket.IO (salas por lote)│             │  edelacruz_Vehiculos │
└──────────────────────────┘   pujas e indicadores   │  - cierre automático (3 s)   │             │  edelacruz_Vehiculo- │
                                                     └──────────────────────────────┘             │    Fotos / _Pujas    │
                                                                                                  └──────────────────────┘
```

**Flujo de una puja:** `POST /api/vehiculos/:id/pujas` → transacción con `UPDLOCK, HOLDLOCK` sobre el vehículo → valida reglas →
inserta la puja y actualiza el monto → *commit* → Socket.IO emite a la sala `vehiculo:<id>` el nuevo monto y, a **cada navegador**,
su indicador personal (`GANANDO` / `SUPERADO`), y al inventario el nuevo precio.

### Estructura del proyecto

```
subastas-copart/
├── server/                       # Backend (Web API + tiempo real)
│   ├── index.js                  # Arranque: HTTP + Socket.IO + inicialización de BD
│   ├── app.js                    # Express: seguridad, rutas, SPA y manejo de errores
│   ├── config.js                 # Variables de entorno (validadas al iniciar)
│   ├── db/
│   │   ├── conexion.js           # Pool de SQL Server
│   │   └── esquema.js            # DDL, catálogos y usuarios de prueba (idempotente)
│   ├── middlewares/
│   │   ├── auth.js               # JWT: requerirAuth / authOpcional
│   │   └── seguridad.js          # Helmet (CSP) y límites de solicitudes
│   ├── services/
│   │   └── subastas.js           # Reglas de puja, estados, cierre automático, Socket.IO
│   ├── routes/                   # Controladores REST
│   │   ├── auth.js               # /api/auth
│   │   ├── catalogos.js          # /api/catalogos
│   │   ├── vehiculos.js          # /api/vehiculos (+ /pujas)
│   │   └── fotos.js              # /api/fotos
│   └── utils/validacion.js       # Validación de entradas (servidor)
├── client/                       # Frontend React (SPA)
│   └── src/
│       ├── main.jsx, App.jsx     # Rutas y layout
│       ├── api.js                # Cliente HTTP con token
│       ├── auth.jsx              # Contexto de sesión
│       ├── socket.js, tiempo.js  # Tiempo real y reloj sincronizado con el servidor
│       ├── components/           # Card, Carrusel, FormVehiculo, etiquetas
│       └── pages/                # Home, Detalle, Login, Registro, Publicar, Editar, MisPublicaciones
├── scripts/seed-demo.js          # Vehículos de demostración
└── render.yaml                   # Despliegue (Blueprint de Render)
```

---

## 🔒 Seguridad

- **Contraseñas** con `bcrypt` (costo 10) y política de contraseña segura (8+ caracteres, mayúscula, minúscula, número y símbolo).
- **JWT** firmado HS256 con secreto aleatorio en variable de entorno (el servidor no arranca en producción sin él); expira en 8 h.
- **Autorización en el servidor**: publicar/editar/ofertar requieren token; solo el publicador edita; no se puede ofertar en lo propio.
- **Inyección SQL**: el 100 % de las consultas usa parámetros (`request.input`).
- **XSS**: React escapa todo el contenido + **Content-Security-Policy** estricta con `helmet` (solo scripts propios).
- **Fuerza bruta**: límite de intentos fallidos de login/registro y de pujas por minuto (`express-rate-limit`).
- **Login** con tiempo constante (no revela si un correo existe).
- **Fotos**: se valida el tipo real por *magic bytes* (JPG/PNG/WEBP), tamaño máximo y cantidad (5–12).
- **Privacidad de postores**: la API y los sockets nunca envían IDs de postores o ganadores.
- **Concurrencia**: pujas simultáneas se serializan con bloqueo de fila; no se aceptan dos ofertas contra el mismo monto.
- **Errores**: el cliente nunca recibe detalles internos (stack/SQL).
- **Secretos** fuera del repositorio (`.env` en `.gitignore`); redirecciones internas validadas (sin *open redirect*).

---

## 📡 API REST

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| POST | `/api/auth/registro` | — | Crear cuenta |
| POST | `/api/auth/login` | — | Iniciar sesión (devuelve JWT) |
| GET | `/api/auth/yo` | ✔ | Usuario de la sesión |
| GET | `/api/catalogos` | — | Catálogos (tipos, combustibles, transmisiones, trenes, daños, marcas) |
| GET | `/api/vehiculos` | opcional | Inventario con filtros (`q, marca, modelo, anioMin, anioMax, tipo, combustible, transmision, tren, cilindros, dano, estado, orden`) |
| GET | `/api/vehiculos/mios?q=` | ✔ | Publicaciones del usuario |
| GET | `/api/vehiculos/:id` | opcional | Detalle, fotos, historial anónimo e indicador personal |
| POST | `/api/vehiculos` | ✔ | Publicar vehículo |
| PUT | `/api/vehiculos/:id` | ✔ (dueño) | Editar publicación |
| POST | `/api/vehiculos/:id/pujas` | ✔ | Ofertar |
| GET | `/api/fotos/:id` | — | Imagen |
| GET | `/api/health` | — | Estado de API y BD |

**Eventos Socket.IO:** `subasta:unirse` / `subasta:salir` (cliente → servidor); `subasta:actualizada` (monto, estado, siguiente mínimo e indicador personal), `inventario:actualizado`, `inventario:cambio`, `vehiculo:editado` (servidor → cliente).

---

## 💻 Ejecutar en local

```bash
npm install
npm --prefix client install
cp .env.example .env        # completar DB_PASSWORD y JWT_SECRET
npm run build               # compila el frontend
npm start                   # http://localhost:3000
npm run seed                # (opcional) vehículos de demostración
```

Desarrollo con recarga en caliente: `npm run dev` (API en :3000) y `npm --prefix client run dev` (Vite en :5173, con proxy a la API).

## 🚀 Despliegue (Render)

El archivo `render.yaml` define el servicio. En Render: **New → Blueprint →** seleccionar este repositorio → ingresar `DB_PASSWORD` → **Apply**.
`JWT_SECRET` se genera automáticamente. Las tablas, catálogos y usuarios de prueba se crean solos al iniciar.

> Fotos de demostración: Wikimedia Commons (licencias libres).
