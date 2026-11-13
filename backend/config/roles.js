// ============================================================
// MODULO: config/roles.js
// ============================================================
// PARA QUE EXISTE:
// En la base de datos los roles estan guardados con numeros
// (tabla rol: 1 = ADMIN, 2 = MEDICO, 3 = PACIENTE).
// Escribir "if (id_rol === 2)" por todo el codigo se entiende
// poco y se presta a errores. Aca les ponemos nombre una sola
// vez y despues usamos los nombres.
//
// COMO SE USA EN EL PROYECTO:
//     const { ROLES } = require('../config/roles');
//     if (req.usuario.nombre_rol === ROLES.MEDICO) { ... }
// y en las rutas:
//     autorizarRol(ROLES.ADMIN, ROLES.MEDICO)
// ============================================================

// Nombres de los roles, tal como estan escritos en la tabla rol.
const ROLES = {
    ADMIN: 'ADMIN',
    MEDICO: 'MEDICO',
    PACIENTE: 'PACIENTE'
};

module.exports = { ROLES };
