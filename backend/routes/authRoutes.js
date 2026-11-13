// ============================================================
// MODULO: routes/authRoutes.js
// ============================================================
// PARA QUE EXISTE:
// Define las direcciones (URL) de autenticacion y dice que
// funcion atiende cada una. Es la "tabla de contenidos" de
// /api/auth.
//
// COMO SE USA EN EL PROYECTO:
// En server.js se enchufa con:
//     app.use('/api/auth', authRoutes);
// Eso hace que la ruta '/login' de este archivo sea en realidad
// http://localhost:3000/api/auth/login
//
// QUE ES express.Router():
// Un mini-router independiente. Sirve para no tener las 20
// rutas del sistema apiladas dentro de server.js: cada tema
// tiene su archivo.
// ============================================================

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const verificarToken = require('../middlewares/authMiddleware');

// ------------------------------------------------------------
// RUTA PUBLICA: iniciar sesion
// ------------------------------------------------------------
// Es la unica que NO pide token, por una razon obvia: todavia
// no lo tenes, justamente lo venis a buscar.
// Es POST porque mandamos datos sensibles en el cuerpo del
// pedido. Con GET la contrasenia quedaria escrita en la
// direccion y en el historial del navegador.
router.post('/login', authController.login);

// ------------------------------------------------------------
// RUTA PROTEGIDA: saber quien soy
// ------------------------------------------------------------
// Aca verificarToken se pone solo en esta ruta (como segundo
// argumento) en vez de con router.use.
// El frontend la usa al cargar el panel para mostrar el nombre
// y el rol del usuario y para comprobar que la sesion sigue viva.
router.get('/perfil', verificarToken, authController.perfil);

module.exports = router;
