// ============================================================
// MODULO: routes/turnoRoutes.js
// ============================================================
// PARA QUE EXISTE:
// Define todas las direcciones de /api/turnos y, sobre todo,
// QUE ROL puede usar cada una. Leyendo este archivo se entiende
// de un vistazo el esquema de permisos del sistema.
//
// COMO SE USA EN EL PROYECTO:
// server.js hace app.use('/api/turnos', turnoRoutes).
//
// COMO SE LEE UNA RUTA:
//     router.post('/',  validarTurno, autorizarRol(...), controlador)
//             |    |         |              |                |
//           metodo url   middleware 1   middleware 2    funcion final
//
// Express ejecuta esa fila de izquierda a derecha. Cada
// middleware decide si llama a next() (y sigue) o si contesta
// un error (y corta). Esto se llama "cadena de middlewares".
//
// TABLA DE PERMISOS:
//   GET    /                      ver turnos          ADMIN / MEDICO / PACIENTE (cada uno los suyos)
//   GET    /:id                   ver un turno        ADMIN / MEDICO / PACIENTE (si es suyo)
//   POST   /                      crear turno         ADMIN / PACIENTE
//   PUT    /:id/reprogramar       reprogramar         ADMIN / PACIENTE
//   PATCH  /:id/confirmar         confirmar           ADMIN / MEDICO
//   PATCH  /:id/cancelar          cancelar            ADMIN / MEDICO / PACIENTE
//   DELETE /:id                   eliminar            ADMIN
// ============================================================

const express = require('express');
const router = express.Router();

const turnoController = require('../controllers/turnoController');
const verificarToken = require('../middlewares/authMiddleware');
const autorizarRol = require('../middlewares/autorizarRol');
const { ROLES } = require('../config/roles');
const {
    validarTurno,
    validarReprogramacion
} = require('../validators/turnoValidator');

// ------------------------------------------------------------
// TODAS las rutas de turnos necesitan sesion iniciada.
// ------------------------------------------------------------
// router.use sin direccion = "aplicale esto a todo lo que
// venga despues en este archivo". Asi no hay que repetir
// verificarToken en cada linea ni se nos puede olvidar en una.
router.use(verificarToken);

// ------------------------------------------------------------
// LECTURA: los tres roles pueden consultar.
// El filtrado por dueno lo hace el controlador.
// ------------------------------------------------------------
router.get(
    '/',
    autorizarRol(ROLES.ADMIN, ROLES.MEDICO, ROLES.PACIENTE),
    turnoController.obtenerTurnos
);

router.get(
    '/:id',
    autorizarRol(ROLES.ADMIN, ROLES.MEDICO, ROLES.PACIENTE),
    turnoController.obtenerTurnoPorId
);

// ------------------------------------------------------------
// CREAR: el administrador o el propio paciente.
// El medico no saca turnos, por eso no esta en la lista.
// ------------------------------------------------------------
router.post(
    '/',
    autorizarRol(ROLES.ADMIN, ROLES.PACIENTE),
    validarTurno,                      // primero la forma de los datos
    turnoController.crearTurno         // despues las reglas y el guardado
);

// ------------------------------------------------------------
// REPROGRAMAR (mejora funcional principal)
// ------------------------------------------------------------
// Usamos PUT porque estamos reemplazando datos de un recurso
// que ya existe.
router.put(
    '/:id/reprogramar',
    autorizarRol(ROLES.ADMIN, ROLES.PACIENTE),
    validarReprogramacion,
    turnoController.reprogramarTurno
);

// ------------------------------------------------------------
// CONFIRMAR
// ------------------------------------------------------------
// El centro es el que confirma (admin o medico), despues de
// hablar con el paciente.
// Usamos PATCH porque solo cambiamos una parte del turno (el
// estado), no el turno completo.
router.patch(
    '/:id/confirmar',
    autorizarRol(ROLES.ADMIN, ROLES.MEDICO),
    turnoController.confirmarTurno
);

// ------------------------------------------------------------
// CANCELAR
// ------------------------------------------------------------
// Puede cancelar cualquiera de los tres, pero solo sobre sus
// propios turnos (eso lo verifica el controlador).
router.patch(
    '/:id/cancelar',
    autorizarRol(ROLES.ADMIN, ROLES.MEDICO, ROLES.PACIENTE),
    turnoController.cancelarTurno
);

// ------------------------------------------------------------
// ELIMINAR: solo el administrador.
// ------------------------------------------------------------
// Borrar es destructivo: lo normal es cancelar. Dejamos el
// DELETE solo para el admin.
router.delete(
    '/:id',
    autorizarRol(ROLES.ADMIN),
    turnoController.eliminarTurno
);

module.exports = router;
