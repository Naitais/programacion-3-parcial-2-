// ============================================================
// MODULO: middlewares/cors.js
// ============================================================
// PARA QUE EXISTE:
// El navegador tiene una regla de seguridad llamada
// "same-origin policy": una pagina solo puede pedir datos por
// JavaScript al MISMO origen del que se bajo.
// Un origen = protocolo + dominio + puerto.
//
//   Frontend (Live Server): http://127.0.0.1:5500
//   Backend  (Express):     http://localhost:3000
//
// Son origenes DISTINTOS (cambia el puerto y el dominio), asi
// que el navegador bloquea la respuesta... salvo que el backend
// avise con unas cabeceras que ese origen esta permitido.
// Eso es CORS: Cross-Origin Resource Sharing.
//
// COMO SE USA EN EL PROYECTO:
// Se enchufa en server.js con app.use(permitirCors) ANTES de
// las rutas, para que todas las respuestas salgan con las
// cabeceras puestas.
//
// NOTA: existe el paquete "cors" de npm que hace lo mismo en
// una linea. Lo escribimos a mano para poder explicar que
// cabeceras se mandan y por que.
// ============================================================

// Lista de origenes a los que les permitimos usar la API.
// Si manianna el frontend se publica en otra direccion, se
// agrega aca y listo.
const ORIGENES_PERMITIDOS = [
    'http://127.0.0.1:5500',    // Live Server de VS Code
    'http://localhost:5500',
    'http://127.0.0.1:3000',    // cuando el frontend lo sirve Express
    'http://localhost:3000'
];

// OBJETIVO DE LA FUNCION:
// Agregar a cada respuesta las cabeceras de CORS y contestar
// solo (sin llegar al controlador) los pedidos de permiso
// "OPTIONS" que manda el navegador.
function permitirCors(req, res, next) {

    // De que origen viene el pedido.
    const origen = req.headers.origin;

    // Si el origen esta en la lista blanca, lo autorizamos.
    if (ORIGENES_PERMITIDOS.includes(origen)) {
        res.setHeader('Access-Control-Allow-Origin', origen);
    }

    // Que metodos HTTP puede usar ese origen.
    res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );

    // Que cabeceras puede mandar. Authorization es la que lleva
    // el token JWT, sin esta linea el login no serviria para
    // nada porque el navegador bloquearia el envio del token.
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
    );

    // Antes de un POST o un PUT con JSON, el navegador manda
    // primero un pedido OPTIONS para preguntar "puedo?".
    // A eso se le dice "preflight". Lo contestamos aca mismo
    // con 204 (todo bien, sin contenido) y no seguimos.
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    // Si no era OPTIONS, que siga el camino normal.
    next();
}

module.exports = permitirCors;
