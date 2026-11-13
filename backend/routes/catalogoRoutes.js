// ============================================================
// MODULO: routes/catalogoRoutes.js
// ============================================================
// PARA QUE EXISTE:
// Define las direcciones de /api/catalogo, que son las listas
// que llenan los desplegables del formulario de turnos.
//
// Son datos no sensibles (nombres de practicas, de medicos,
// de equipos), pero igual pedimos token: si no hay sesion
// iniciada, no hay nada que mostrar en el panel.
// Los tres roles pueden leerlas.
// ============================================================

const express = require('express');
const router = express.Router();

const catalogoController = require('../controllers/catalogoController');
const verificarToken = require('../middlewares/authMiddleware');

// Sesion obligatoria para todo el catalogo.
router.use(verificarToken);

router.get('/servicios', catalogoController.obtenerServicios);
router.get('/practicas', catalogoController.obtenerPracticas);

// Estas dos aceptan el filtro ?id_practica=3
router.get('/medicos', catalogoController.obtenerMedicos);
router.get('/equipos', catalogoController.obtenerEquipos);

// Esta acepta ?matricula_medico=1001
router.get('/disponibilidades', catalogoController.obtenerDisponibilidades);

module.exports = router;
