// ============================================================
// MODULO: middlewares/authMiddleware.js
// ============================================================
// PARA QUE EXISTE:
// Es el "portero" de la API. Antes de dejar pasar un pedido a
// una ruta protegida, revisa que venga un token JWT valido.
// Si el token esta bien, guarda los datos del usuario en
// req.usuario para que los controladores sepan QUIEN esta
// pidiendo las cosas.
//
// COMO SE USA EN EL PROYECTO:
// En los archivos de rutas se pone antes de los controladores:
//     router.use(verificarToken);
// A partir de esa linea, todas las rutas de ese router exigen
// token. Esto cumple el pedido del parcial de "proteger las
// rutas del backend".
//
// QUE ES AUTENTICACION (lo que hace este archivo):
// Responder la pregunta "quien sos". La autorizacion ("que
// podes hacer") la resuelve autorizarRol.js.
// ============================================================

const jwt = require('jsonwebtoken');

// OBJETIVO DE LA FUNCION:
// Leer la cabecera Authorization, validar la firma del token y
// dejar al usuario identificado en req.usuario.
function verificarToken(req, res, next) {

    // El frontend manda la cabecera asi:
    //     Authorization: Bearer eyJhbGciOi...
    const cabecera = req.headers.authorization;

    // 1) Que la cabecera exista y tenga el formato correcto.
    if (!cabecera || !cabecera.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Se requiere un token de autenticacion'
        });
    }

    // 2) Separamos la palabra "Bearer" del token.
    //    "Bearer abc.def.ghi".split(' ') -> ['Bearer', 'abc.def.ghi']
    const token = cabecera.split(' ')[1];

    try {
        // 3) jwt.verify hace dos cosas:
        //    - comprueba que la FIRMA coincida con JWT_SECRET
        //      (si alguien cambio un dato del token, falla),
        //    - comprueba que no este vencido (expiresIn).
        const datosDelToken = jwt.verify(token, process.env.JWT_SECRET);

        // 4) Dejamos los datos del usuario pegados al pedido.
        //    Desde aca en adelante, cualquier controlador puede
        //    hacer req.usuario.id_rol o req.usuario.dni_paciente.
        req.usuario = datosDelToken;

        // 5) next() = "listo, que siga al proximo middleware o
        //    al controlador". Si no lo llamamos, el pedido se
        //    queda colgado para siempre.
        next();

    } catch (error) {
        // Token invalido, mal firmado o vencido.
        // 401 = no autenticado.
        return res.status(401).json({
            error: 'Token invalido o vencido. Volve a iniciar sesion'
        });
    }
}

module.exports = verificarToken;
