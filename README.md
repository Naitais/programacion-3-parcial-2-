# Sistema de Gestión de Turnos Médicos

Ampliación del sistema desarrollado durante la cursada — **2° Parcial de
Programación III**.

Backend con **Node.js + Express + MySQL**, frontend con **HTML, CSS y
JavaScript puro**, autenticación con **JWT** y contraseñas hasheadas con
**bcrypt**.

---

## 1. Puesta en marcha

### Requisitos
- Node.js 18 o superior
- MySQL 8

### Pasos

```bash
# 1) Importar la base de datos (MySQL Workbench o terminal)
#    database/gestion_turnos.sql      -> estructura y datos
#    database/cambios_parcial2.sql    -> cambios de este parcial

# 2) Instalar las dependencias
cd backend
npm install

# 3) Crear el archivo de configuración (no se sube al repo)
#    copy .env.example .env      (en Linux/Mac: cp .env.example .env)
#    y en backend/.env ajustar DB_PORT, DB_PASSWORD y JWT_SECRET

# 4) Probar la conexión
node scripts/test-db.js

# 5) Crear los usuarios de los tres perfiles
node scripts/crearUsuarios.js

# 6) Levantar el servidor
npm start
```

Después abrir **http://localhost:3000** (el backend también sirve el
frontend). También funciona con **Live Server** en el puerto 5500: en ese
caso entra en juego el middleware de CORS.

### Usuarios de prueba

| Perfil | Email | Contraseña | Vinculado a |
|---|---|---|---|
| Administrador | `admin@turnos.com` | `AdminTurnos2026!` | — |
| Médico | `medico@turnos.com` | `MedicoTurnos2026!` | matrícula 1001 |
| Paciente | `paciente@turnos.com` | `PacienteTurnos2026!` | DNI 30100101 |

---

## 2. Estructura del proyecto

```
gestion-turnos/
├── backend/
│   ├── server.js                  arranque, middlewares generales y rutas
│   ├── package.json               dependencias y scripts
│   ├── .env                       configuración (NO se sube al repo)
│   ├── config/
│   │   ├── database.js            pool de conexiones a MySQL
│   │   └── roles.js               nombres de los roles
│   ├── routes/                    qué dirección existe y quién puede entrar
│   │   ├── authRoutes.js
│   │   ├── turnoRoutes.js
│   │   ├── pacienteRoutes.js
│   │   └── catalogoRoutes.js
│   ├── controllers/               coordinan el pedido y arman la respuesta
│   │   ├── authController.js
│   │   ├── turnoController.js
│   │   ├── pacienteController.js
│   │   └── catalogoController.js
│   ├── services/                  TODO el SQL
│   │   ├── authService.js
│   │   ├── turnoService.js
│   │   ├── pacienteService.js
│   │   └── catalogoService.js
│   ├── validators/
│   │   ├── turnoValidator.js      formato y campos obligatorios
│   │   └── reglasTurno.js         las 10 reglas de negocio
│   ├── middlewares/
│   │   ├── authMiddleware.js      verifica el token (autenticación)
│   │   ├── autorizarRol.js        verifica el rol (autorización)
│   │   ├── cors.js                permite el frontend de otro puerto
│   │   └── manejadorErrores.js    manejo centralizado de errores
│   └── scripts/
│       ├── test-db.js             prueba la conexión
│       └── crearUsuarios.js       crea los usuarios de los 3 perfiles
│
├── frontend/
│   ├── index.html                 pantalla de login
│   ├── css/estilos.css
│   ├── js/
│   │   ├── sesion.js              guarda y lee el token
│   │   ├── api.js                 todas las llamadas al backend
│   │   ├── app.js                 lógica del login
│   │   └── dashboard.js           lógica del panel
│   └── pages/dashboard.html       panel principal
│
├── database/
│   ├── gestion_turnos.sql         base original de la cursada
│   └── cambios_parcial2.sql       cambios de este parcial
│
└── README.md
```

---

## 3. Endpoints de la API

Todas las rutas requieren la cabecera `Authorization: Bearer <token>`,
excepto el login.

### Autenticación — `/api/auth`

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| POST | `/login` | público | devuelve el token y los datos del usuario |
| GET | `/perfil` | autenticado | dice quién inició sesión |

### Turnos — `/api/turnos`

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| GET | `/` | los 3 roles | lista de turnos, filtrada según el rol |
| GET | `/:id` | los 3 roles | un turno (si le corresponde) |
| POST | `/` | admin, paciente | crea un turno |
| PUT | `/:id/reprogramar` | admin, paciente | cambia fecha, hora y franja |
| PATCH | `/:id/confirmar` | admin, médico | pasa a Confirmado |
| PATCH | `/:id/cancelar` | los 3 roles | pasa a Cancelado |
| DELETE | `/:id` | admin | borra el turno |

Filtros de `GET /api/turnos` (se combinan):
`?fecha_desde=2026-11-01&fecha_hasta=2026-11-30&estado=Reservado`
El admin además puede usar `?dni_paciente=` y `?matricula_medico=`.

### Pacientes — `/api/pacientes`

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| GET | `/` | admin, médico | lista, con búsqueda `?texto=perez` |
| GET | `/:dni` | los 3 roles | ficha (el paciente, solo la propia) |
| PUT | `/:dni` | admin, paciente | actualiza teléfono y email |

### Catálogos — `/api/catalogo`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/servicios` | lista de servicios |
| GET | `/practicas` | prácticas con duración y servicio |
| GET | `/medicos?id_practica=3` | médicos habilitados para esa práctica |
| GET | `/equipos?id_practica=3` | equipos compatibles con esa práctica |
| GET | `/disponibilidades?matricula_medico=1001` | franjas horarias del médico |

---

## 4. Permisos por perfil

| Operación | ADMIN | MÉDICO | PACIENTE |
|---|:---:|:---:|:---:|
| Ver turnos | todos | solo su agenda | solo los suyos |
| Crear turno | sí | no | solo para sí mismo |
| Reprogramar | sí | no | solo los suyos |
| Confirmar | sí | sí (los suyos) | no |
| Cancelar | sí | sí (los suyos) | solo los suyos |
| Eliminar | sí | no | no |
| Listar pacientes | sí | sí | no |
| Ver ficha de paciente | cualquiera | cualquiera | solo la suya |
| Modificar ficha | cualquiera | no | solo la suya |

El control se hace en **dos niveles**:

1. **Por rol**, en las rutas, con el middleware `autorizarRol(...)` → **403**.
2. **Por dueño del dato**, en el controlador, comparando el turno con los
   datos que vienen **dentro del token** → **403**.

---

## 5. Pruebas con Thunder Client

```http
### 1) Login
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "paciente@turnos.com",
  "password": "PacienteTurnos2026!"
}

### 2) Sin token -> 401
GET http://localhost:3000/api/turnos

### 3) Con token -> solo los turnos propios
GET http://localhost:3000/api/turnos
Authorization: Bearer PEGAR_EL_TOKEN

### 4) Turno de otro paciente -> 403
GET http://localhost:3000/api/turnos/1
Authorization: Bearer PEGAR_EL_TOKEN

### 5) Borrar siendo paciente -> 403
DELETE http://localhost:3000/api/turnos/1
Authorization: Bearer PEGAR_EL_TOKEN

### 6) Crear un turno con fecha pasada -> 400
POST http://localhost:3000/api/turnos
Authorization: Bearer PEGAR_EL_TOKEN
Content-Type: application/json

{
  "fecha_turno": "2020-01-01",
  "hora_turno": "09:00",
  "id_practica": 1,
  "matricula_medico": 1001,
  "id_disponibilidad": 1,
  "dni_paciente": 30100101,
  "medio_solicitado": "Web"
}
```

---

## 6. Notas técnicas

- **El médico de un turno** está en la tabla `registra`, no en `turno`. Por
  eso las consultas hacen `JOIN registra` y crear un turno usa una
  transacción con dos INSERT.
- **Las fechas** se devuelven con `DATE_FORMAT(..., '%Y-%m-%d')` para que no
  se corran por la zona horaria al convertirlas a JSON.
- **La superposición de turnos** se calcula con la duración de la práctica
  (`ADDTIME` + `SEC_TO_TIME`), ignorando los turnos cancelados.
- **No se agregaron tecnologías nuevas**: se usan las mismas cinco
  dependencias trabajadas en la cursada (`express`, `mysql2`, `dotenv`,
  `bcryptjs`, `jsonwebtoken`). CORS está escrito a mano como middleware
  propio para no sumar un paquete más.
- **El archivo `.env` no se sube al repositorio** (está en `.gitignore`).
  Hay un `.env.example` como referencia.
