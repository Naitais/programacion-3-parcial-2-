// ============================================================
// MODULO: server.js
// ============================================================
// PARA QUE EXISTE:
// Es el punto de entrada del backend. Es el primer archivo que
// ejecuta Node ("node server.js"). Su trabajo es:
//   1) crear la aplicacion de Express,
//   2) enchufar los middlewares generales,
//   3) decir que grupo de rutas atiende cada direccion,
//   4) poner el servidor a escuchar en un puerto.
//
// COMO SE USA EN EL PROYECTO:
// Se arranca con "npm start" o "node server.js" desde la
// carpeta backend. Queda escuchando en http://localhost:3000
// y desde ahi responde todos los pedidos del frontend.
//
// ORDEN DE LAS COSAS (muy importante):
// Express ejecuta los middlewares EN EL ORDEN en que se
// escriben. Primero CORS, despues el lector de JSON, despues
// las rutas y AL FINAL el manejador de errores.
// ============================================================

const express = require('express');
const path = require('path');

// Carga las variables del archivo .env (puerto, clave secreta, etc).
// Le pasamos la ruta exacta para que funcione sin importar desde
// que carpeta se ejecute el comando (__dirname = carpeta backend).
require('dotenv').config({ path: path.join(__dirname, '.env') });

// --- Middlewares propios ---
const permitirCors = require('./middlewares/cors');
const manejadorErrores = require('./middlewares/manejadorErrores');

// --- Grupos de rutas ---
const authRoutes = require('./routes/authRoutes');
const turnoRoutes = require('./routes/turnoRoutes');
const pacienteRoutes = require('./routes/pacienteRoutes');
const catalogoRoutes = require('./routes/catalogoRoutes');

// Creamos la aplicacion.
const app = express();

// ============================================================
// 1) MIDDLEWARES GENERALES
// ============================================================

// Permite que el frontend (que corre en otro puerto) pueda
// hablarle a esta API. Ver middlewares/cors.js.
app.use(permitirCors);

// Lee el cuerpo de los pedidos que vienen en formato JSON y lo
// deja listo en req.body. Sin esto, req.body llega undefined.
app.use(express.json());

// Muestra por consola cada pedido que llega. Sirve para la
// demostracion: se ve en vivo que el frontend llama a la API.
app.use(function registrarPedido(req, res, next) {
    console.log(`-> ${req.method} ${req.originalUrl}`);
    next();
});

// Sirve el frontend desde el mismo servidor. Es una comodidad:
// si abrimos http://localhost:3000 vemos la pantalla de login
// sin necesitar Live Server.
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ============================================================
// 2) RUTAS DE LA API
// ============================================================
// Cada "app.use" dice: todo lo que empiece con esta direccion
// lo atiende este archivo de rutas.

app.use('/api/auth', authRoutes);
app.use('/api/turnos', turnoRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/catalogo', catalogoRoutes);

// ============================================================
// 3) RUTA NO ENCONTRADA
// ============================================================
// Si el pedido empieza con /api y ningun router lo atendio,
// devolvemos 404 en JSON (y no una pagina de error de Express).
app.use('/api', function rutaNoEncontrada(req, res) {
    res.status(404).json({
        error: 'La ruta solicitada no existe'
    });
});

// ============================================================
// 4) MANEJO CENTRALIZADO DE ERRORES
// ============================================================
// Va SIEMPRE al final. Atrapa cualquier error que los
// controladores le pasen con next(error).
app.use(manejadorErrores);

// ============================================================
// 5) ENCENDER EL SERVIDOR
// ============================================================
const PUERTO = process.env.PORT || 3000;

app.listen(PUERTO, function () {
    console.log('============================================');
    console.log(`Servidor funcionando en http://localhost:${PUERTO}`);
    console.log(`Frontend:  http://localhost:${PUERTO}/index.html`);
    console.log(`API:       http://localhost:${PUERTO}/api/turnos`);
    console.log('============================================');
});
