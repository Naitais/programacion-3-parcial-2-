// ============================================================
// MODULO: middlewares/manejadorErrores.js
// ============================================================
// PARA QUE EXISTE:
// Para no repetir el mismo try/catch con el mismo mensaje en
// los 15 controladores. Es el "manejo centralizado de errores"
// que pide la consigna: un unico lugar donde se decide que se
// le contesta al frontend cuando algo sale mal.
//
// COMO SE USA EN EL PROYECTO:
// Se enchufa al FINAL de server.js (despues de las rutas).
// Un controlador que tiene un problema hace:
//     next(error);
// y Express saltea todo lo que sigue y viene directo aca.
//
// COMO LO RECONOCE EXPRESS:
// Por la cantidad de parametros. Un middleware normal tiene 3
// (req, res, next); el de errores tiene 4 y el primero es el
// error. Si le saco el parametro "error", Express lo trata como
// middleware comun y nunca atrapa nada.
// ============================================================

// OBJETIVO DE LA FUNCION:
// Mostrar el error completo en la consola del servidor (para
// el programador) y devolver un JSON corto y prolijo al
// frontend (para el usuario).
function manejadorErrores(error, req, res, next) {

    // Para nosotros: el error completo en la terminal.
    console.error('ERROR en', req.method, req.originalUrl);
    console.error(error);

    // Si el error trae un codigo de estado propio lo usamos;
    // si no, asumimos 500 (error interno del servidor).
    const estado = error.status || 500;

    // Errores tipicos de MySQL traducidos a algo entendible.
    let mensaje = error.mensajeParaUsuario || 'Error interno del servidor';

    if (error.code === 'ER_DUP_ENTRY') {
        mensaje = 'Ese registro ya existe en la base de datos';
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        mensaje = 'Alguno de los datos relacionados no existe';
    }

    if (error.code === 'ECONNREFUSED') {
        mensaje = 'No se pudo conectar con la base de datos MySQL';
    }

    // Este lo tira express.json() cuando el JSON que mandamos
    // esta mal escrito (una coma de mas, falta una llave...).
    // Pasa seguido probando con Thunder Client.
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: 'El JSON enviado tiene un error de formato'
        });
    }

    res.status(estado).json({ error: mensaje });
}

module.exports = manejadorErrores;
