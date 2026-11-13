// ============================================================
// MODULO: middlewares/autorizarRol.js
// ============================================================
// PARA QUE EXISTE:
// Resuelve la AUTORIZACION: una vez que sabemos quien es el
// usuario (eso lo hizo authMiddleware), hay que decidir si su
// rol tiene permiso para hacer esa operacion.
// Ejemplo: un paciente puede ver sus turnos, pero no puede
// borrar turnos de la base.
//
// COMO SE USA EN EL PROYECTO:
// En los archivos de rutas, despues de verificarToken:
//     router.delete('/:id',
//         autorizarRol(ROLES.ADMIN),
//         turnoController.eliminarTurno
//     );
//
// DETALLE TECNICO IMPORTANTE PARA LA DEFENSA:
// Esta no es una funcion middleware comun. Es una funcion que
// DEVUELVE un middleware. Se le dice "fabrica de middlewares".
// Lo hacemos asi porque Express solo le pasa (req, res, next) a
// los middlewares: no hay forma de pasarle los roles permitidos.
// Entonces la funcion de afuera recibe los roles, y la de
// adentro (la que Express va a ejecutar) se los "acuerda"
// gracias a las CLAUSURAS (closures) de JavaScript.
// ============================================================

// OBJETIVO DE LA FUNCION:
// Recibir una lista de roles permitidos y devolver el
// middleware que corta el pedido si el rol no esta en la lista.
//
// Los tres puntos (...rolesPermitidos) son el "rest operator":
// junta todos los argumentos sueltos en un array.
//     autorizarRol('ADMIN', 'MEDICO')
//     -> rolesPermitidos = ['ADMIN', 'MEDICO']
function autorizarRol(...rolesPermitidos) {

    // Esta funcion de adentro es la que realmente ejecuta Express.
    return function (req, res, next) {

        // 1) Si no hay usuario, significa que alguien se olvido
        //    de poner verificarToken antes. 401 = no autenticado.
        if (!req.usuario) {
            return res.status(401).json({
                error: 'Se requiere autenticacion'
            });
        }

        // 2) El rol viene dentro del token (no lo manda el
        //    frontend por separado). Esto es clave: el usuario
        //    NO puede mentir sobre su rol, porque el token esta
        //    firmado y cualquier cambio rompe la firma.
        const rolDelUsuario = req.usuario.nombre_rol;

        // 3) Si su rol no esta entre los permitidos, se corta.
        //    403 = estas identificado, pero no tenes permiso.
        if (!rolesPermitidos.includes(rolDelUsuario)) {
            return res.status(403).json({
                error: 'No tenes permisos para realizar esta accion'
            });
        }

        // 4) Tiene permiso: que siga.
        next();
    };
}

module.exports = autorizarRol;
