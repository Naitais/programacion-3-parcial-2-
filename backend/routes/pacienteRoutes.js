// ============================================================
// MODULO: routes/pacienteRoutes.js
// ============================================================
// PARA QUE EXISTE:
// Define las direcciones de /api/pacientes con sus permisos.
//
// TABLA DE PERMISOS:
//   GET /            listar pacientes        ADMIN / MEDICO
//   GET /:dni        ver una ficha           ADMIN / MEDICO / PACIENTE (la suya)
//   PUT /:dni        actualizar contacto     ADMIN / PACIENTE (la suya)
//
// Notar la diferencia entre los dos controles:
//   - autorizarRol mira SOLO el rol (no sabe de que paciente
//     se trata).
//   - el controlador compara el DNI de la direccion con el DNI
//     del token, porque eso depende del dato concreto.
// Los dos controles son necesarios y se complementan.
// ============================================================

const express = require('express');
const router = express.Router();

const pacienteController = require('../controllers/pacienteController');
const verificarToken = require('../middlewares/authMiddleware');
const autorizarRol = require('../middlewares/autorizarRol');
const { ROLES } = require('../config/roles');

// Sesion obligatoria para todo lo de pacientes.
router.use(verificarToken);

// Listar: un paciente no tiene por que ver el listado completo
// de pacientes del centro, asi que no esta autorizado.
router.get(
    '/',
    autorizarRol(ROLES.ADMIN, ROLES.MEDICO),
    pacienteController.obtenerPacientes
);

// Ver una ficha: los tres roles entran a la ruta, pero el
// controlador deja pasar al paciente solo si el DNI es el suyo.
router.get(
    '/:dni',
    autorizarRol(ROLES.ADMIN, ROLES.MEDICO, ROLES.PACIENTE),
    pacienteController.obtenerPacientePorDni
);

// Actualizar datos de contacto.
router.put(
    '/:dni',
    autorizarRol(ROLES.ADMIN, ROLES.PACIENTE),
    pacienteController.actualizarPaciente
);

module.exports = router;
