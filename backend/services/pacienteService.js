// ============================================================
// MODULO: services/pacienteService.js
// ============================================================
// PARA QUE EXISTE:
// Maneja las consultas de la tabla paciente. Cubre la parte de
// "mejorar una operacion CRUD" del parcial: listar, buscar por
// DNI y actualizar los datos de contacto.
//
// COMO SE USA EN EL PROYECTO:
// - El administrador lista pacientes para elegir a quien le
//   carga un turno.
// - El recepcionista (admin) completa los datos que faltan
//   cuando el paciente se presenta en el centro.
// - El paciente puede ver y corregir sus propios datos.
// ============================================================

const db = require('../config/database');

// OBJETIVO: listar pacientes con su obra social.
// Permite buscar por apellido o DNI (filtro opcional "texto").
// LEFT JOIN con obra_social porque un paciente puede no tener.
async function listarPacientes(texto) {

    let sql = `
        SELECT p.dni_paciente,
               p.nombre_paciente,
               p.apellido_paciente,
               p.tel_paciente,
               p.email_paciente,
               p.nro_afiliado_paciente,
               os.nombre_os
        FROM paciente p
        LEFT JOIN obra_social os ON os.id_os = p.id_os
    `;

    const parametros = [];

    if (texto) {
        // LIKE con % busca "que contenga". El signo de pregunta
        // sigue protegiendo de inyeccion de SQL.
        sql += ` WHERE p.apellido_paciente LIKE ?
                    OR p.nombre_paciente LIKE ?
                    OR p.dni_paciente LIKE ?`;
        parametros.push(`%${texto}%`, `%${texto}%`, `%${texto}%`);
    }

    sql += ' ORDER BY p.apellido_paciente, p.nombre_paciente';

    const [filas] = await db.execute(sql, parametros);
    return filas;
}

// OBJETIVO: traer un paciente por su DNI.
// Devuelve el paciente o undefined si no existe.
async function obtenerPacientePorDni(dni) {
    const [filas] = await db.execute(
        `SELECT p.dni_paciente,
                p.nombre_paciente,
                p.apellido_paciente,
                DATE_FORMAT(p.fec_nac_paciente, '%Y-%m-%d') AS fec_nac_paciente,
                p.tel_paciente,
                p.email_paciente,
                p.nro_afiliado_paciente,
                p.id_os,
                os.nombre_os
         FROM paciente p
         LEFT JOIN obra_social os ON os.id_os = p.id_os
         WHERE p.dni_paciente = ?`,
        [dni]
    );

    return filas[0];
}

// OBJETIVO: actualizar los datos de contacto de un paciente.
// Solo dejamos modificar telefono y email: el DNI es la clave
// primaria y el nombre no deberia cambiar por una correccion
// de mostrador.
async function actualizarContacto(dni, datos) {
    const [resultado] = await db.execute(
        `UPDATE paciente
         SET tel_paciente   = ?,
             email_paciente = ?
         WHERE dni_paciente = ?`,
        [
            datos.tel_paciente || null,
            datos.email_paciente || null,
            dni
        ]
    );

    return resultado.affectedRows === 1;
}

module.exports = {
    listarPacientes,
    obtenerPacientePorDni,
    actualizarContacto
};
