// ============================================================
// MODULO: services/catalogoService.js
// ============================================================
// PARA QUE EXISTE:
// El formulario de turnos necesita llenar varias listas
// desplegables: practicas, medicos, equipos y franjas horarias.
// Este service trae esos datos "de catalogo" (datos que se leen
// pero casi nunca se modifican).
//
// COMO SE USA EN EL PROYECTO:
// El frontend pide /api/catalogo/practicas, elige una, y con
// ese id pide /api/catalogo/medicos?id_practica=3. Asi el
// usuario solo puede elegir combinaciones que ya son validas.
//
// POR QUE ES IMPORTANTE PARA EL PARCIAL:
// Es la cara visible de las tablas intermedias del modelo:
//   practica_medico  -> que practicas hace cada medico
//   practica_equipo  -> en que equipos se hace cada practica
//   medico_disponibilidad -> en que franjas atiende cada medico
// El frontend GUIA al usuario con estos datos, y el backend
// igual vuelve a validarlo todo en reglasTurno.js.
// ============================================================

const db = require('../config/database');

// OBJETIVO: lista de servicios (Cardiologia, Pediatria, ...).
async function listarServicios() {
    const [filas] = await db.query(
        `SELECT id_servicio, nombre_servicio
         FROM servicio
         ORDER BY nombre_servicio`
    );
    return filas;
}

// OBJETIVO: lista de practicas con el servicio al que pertenecen.
//
// NOTA SOBRE LOS ALIAS: en todo el proyecto usamos siempre las
// mismas iniciales para que las consultas se lean igual en
// cualquier archivo: p = paciente, pr = practica, m = medico,
// e = equipo, s = servicio, r = registra, d = disponibilidad,
// u = usuario.
async function listarPracticas() {
    const [filas] = await db.query(
        `SELECT pr.id_practica,
                pr.nombre_practica,
                pr.duracion,
                s.nombre_servicio
         FROM practica pr
         JOIN servicio s ON s.id_servicio = pr.id_servicio
         ORDER BY s.nombre_servicio, pr.nombre_practica`
    );
    return filas;
}

// OBJETIVO: traer los medicos que PUEDEN hacer una practica.
// Si no se pasa practica, devuelve todos los medicos.
// El filtro sale de la tabla practica_medico.
async function listarMedicos(idPractica) {

    if (idPractica) {
        const [filas] = await db.execute(
            `SELECT m.matricula_medico,
                    CONCAT(m.apellido_medico, ', ', m.nombre_medico) AS medico
             FROM medico m
             JOIN practica_medico pm
                  ON pm.matricula_medico = m.matricula_medico
             WHERE pm.id_practica = ?
             ORDER BY m.apellido_medico`,
            [idPractica]
        );
        return filas;
    }

    const [filas] = await db.query(
        `SELECT m.matricula_medico,
                CONCAT(m.apellido_medico, ', ', m.nombre_medico) AS medico
         FROM medico m
         ORDER BY m.apellido_medico`
    );
    return filas;
}

// OBJETIVO: traer los equipos compatibles con una practica.
// El filtro sale de la tabla practica_equipo.
async function listarEquipos(idPractica) {

    if (idPractica) {
        const [filas] = await db.execute(
            `SELECT e.id_equipo, e.nombre_equipo
             FROM equipo e
             JOIN practica_equipo pe ON pe.id_equipo = e.id_equipo
             WHERE pe.id_practica = ?
             ORDER BY e.nombre_equipo`,
            [idPractica]
        );
        return filas;
    }

    const [filas] = await db.query(
        `SELECT id_equipo, nombre_equipo
         FROM equipo
         ORDER BY nombre_equipo`
    );
    return filas;
}

// OBJETIVO: traer las franjas horarias en las que atiende un
// medico (dia, hora desde, hora hasta).
// Sale de medico_disponibilidad + disponibilidad.
async function listarDisponibilidades(matriculaMedico) {
    const [filas] = await db.execute(
        `SELECT d.id_disponibilidad,
                d.dia,
                d.hora_desde,
                d.hora_hasta
         FROM medico_disponibilidad md
         JOIN disponibilidad d
              ON d.id_disponibilidad = md.id_disponibilidad
         WHERE md.matricula_medico = ?
         ORDER BY FIELD(d.dia, 'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'),
                  d.hora_desde`,
        [matriculaMedico]
    );
    return filas;
}

module.exports = {
    listarServicios,
    listarPracticas,
    listarMedicos,
    listarEquipos,
    listarDisponibilidades
};
