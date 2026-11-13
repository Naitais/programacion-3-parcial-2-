// ============================================================
// MODULO: services/turnoService.js
// ============================================================
// PARA QUE EXISTE:
// Es la capa que habla con MySQL. Aca esta TODO el SQL de los
// turnos y nada mas: no hay req, no hay res, no hay codigos
// HTTP. Solo funciones que reciben datos, consultan la base y
// devuelven datos.
//
// COMO SE USA EN EL PROYECTO:
// Lo usa turnoController.js:
//     const turnos = await turnoService.buscarTurnos(filtros);
//
// POR QUE SEPARAR EL SERVICE DEL CONTROLLER:
// 1) Si manianna cambia una consulta, se toca un solo archivo.
// 2) La misma funcion la pueden usar varios controladores.
// 3) El controlador queda corto y facil de leer.
// 4) Se puede probar el SQL sin levantar el servidor web.
// ============================================================

const db = require('../config/database');

// ------------------------------------------------------------
// CONSULTA BASE
// ------------------------------------------------------------
// La reutilizamos en la lista y en el "buscar por id" para no
// repetir los JOIN.
//
// DETALLE DE LOS JOIN:
//   - paciente y practica van con JOIN comun porque un turno
//     SIEMPRE tiene paciente y practica (son NOT NULL).
//   - equipo, registra y medico van con LEFT JOIN porque
//     pueden no estar cargados. Con un JOIN comun, esos turnos
//     desaparecerian de la lista.
//
// POR QUE DATE_FORMAT EN LA FECHA:
// Si traemos la fecha tal cual, el driver la convierte en un
// objeto Date de JavaScript y al pasarla a JSON se transforma
// en algo como "2026-11-20T03:00:00.000Z" (se corre por la
// zona horaria). Formateandola en SQL llega como texto
// "2026-11-20" y se muestra siempre bien.
const CONSULTA_BASE = `
    SELECT
        t.id_turno,
        DATE_FORMAT(t.fecha_turno, '%Y-%m-%d')      AS fecha_turno,
        t.hora_turno,
        t.estado_turno,
        t.medio_solicitado,
        t.fecha_confirmacion,
        t.dni_paciente,
        CONCAT(p.apellido_paciente, ', ', p.nombre_paciente) AS paciente,
        t.id_practica,
        pr.nombre_practica,
        pr.duracion,
        t.id_equipo,
        e.nombre_equipo,
        t.id_disponibilidad,
        r.matricula_medico,
        CONCAT(m.apellido_medico, ', ', m.nombre_medico)     AS medico,
        s.nombre_servicio
    FROM turno t
    JOIN paciente  p  ON p.dni_paciente  = t.dni_paciente
    JOIN practica  pr ON pr.id_practica  = t.id_practica
    JOIN servicio  s  ON s.id_servicio   = pr.id_servicio
    LEFT JOIN equipo   e ON e.id_equipo         = t.id_equipo
    LEFT JOIN registra r ON r.id_turno          = t.id_turno
    LEFT JOIN medico   m ON m.matricula_medico  = r.matricula_medico
`;

// ============================================================
// FUNCION: buscarTurnos
// ============================================================
// OBJETIVO DE LA FUNCION:
// Traer la lista de turnos aplicando filtros opcionales.
// Es la base de la mejora funcional "busqueda y filtros" y
// TAMBIEN del control de permisos: el controlador le pasa a la
// fuerza el dni del paciente o la matricula del medico que
// inicio sesion, para que cada uno vea solo lo suyo.
//
// COMO ARMAMOS EL WHERE DINAMICO:
// Empezamos con una condicion que siempre es verdadera (1 = 1)
// y le vamos agregando " AND ..." solo por los filtros que
// llegaron. Los valores van en el array "parametros" y se
// mandan aparte con los signos de pregunta: asi el driver los
// escapa y nos protege de inyeccion de SQL.
async function buscarTurnos(filtros = {}) {

    let condiciones = ' WHERE 1 = 1';
    const parametros = [];

    // Filtro por fecha desde.
    if (filtros.fecha_desde) {
        condiciones += ' AND t.fecha_turno >= ?';
        parametros.push(filtros.fecha_desde);
    }

    // Filtro por fecha hasta.
    if (filtros.fecha_hasta) {
        condiciones += ' AND t.fecha_turno <= ?';
        parametros.push(filtros.fecha_hasta);
    }

    // Filtro por estado (Reservado / Confirmado / Cancelado).
    if (filtros.estado) {
        condiciones += ' AND t.estado_turno = ?';
        parametros.push(filtros.estado);
    }

    // Filtro por paciente. Tambien lo usa el control de acceso.
    if (filtros.dni_paciente) {
        condiciones += ' AND t.dni_paciente = ?';
        parametros.push(filtros.dni_paciente);
    }

    // Filtro por medico. Tambien lo usa el control de acceso.
    if (filtros.matricula_medico) {
        condiciones += ' AND r.matricula_medico = ?';
        parametros.push(filtros.matricula_medico);
    }

    const sql = CONSULTA_BASE + condiciones +
        ' ORDER BY t.fecha_turno, t.hora_turno';

    const [turnos] = await db.execute(sql, parametros);
    return turnos;
}

// ============================================================
// FUNCION: obtenerTurnoPorId
// ============================================================
// OBJETIVO DE LA FUNCION:
// Traer un turno con todos sus datos relacionados.
// Devuelve el turno o undefined si no existe.
// La usamos antes de modificar: primero miramos como esta el
// turno y recien despues decidimos si se puede tocar.
async function obtenerTurnoPorId(idTurno) {
    const [turnos] = await db.execute(
        CONSULTA_BASE + ' WHERE t.id_turno = ?',
        [idTurno]
    );

    // turnos es un array. Si esta vacio, devolvemos undefined.
    return turnos[0];
}

// ============================================================
// FUNCION: crearTurno
// ============================================================
// OBJETIVO DE LA FUNCION:
// Guardar un turno nuevo. Son DOS inserts que tienen que pasar
// juntos: uno en "turno" y otro en "registra" (que es la tabla
// que relaciona el turno con el medico y su franja horaria).
//
// POR QUE USAMOS UNA TRANSACCION:
// Si el primer insert sale bien y el segundo falla, quedaria un
// turno sin medico asignado: datos basura. Con la transaccion,
// o se guardan los dos o no se guarda ninguno.
//   beginTransaction -> arranca
//   commit           -> confirma los cambios
//   rollback         -> deshace todo
async function crearTurno(datos) {

    // Pedimos UNA conexion del pool. La transaccion tiene que
    // viajar toda por la misma conexion.
    const conexion = await db.getConnection();

    try {
        await conexion.beginTransaction();

        // 1) Insertamos el turno.
        const [resultado] = await conexion.execute(
            `INSERT INTO turno (
                fecha_turno,
                hora_turno,
                medio_solicitado,
                estado_turno,
                dni_paciente,
                id_practica,
                id_equipo,
                id_disponibilidad
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                datos.fecha_turno,
                datos.hora_turno,
                datos.medio_solicitado || 'Web',
                // Un turno nuevo siempre nace Reservado: todavia
                // no lo confirmo el paciente.
                'Reservado',
                datos.dni_paciente,
                datos.id_practica,
                datos.id_equipo || null,
                datos.id_disponibilidad
            ]
        );

        // insertId es el id autoincremental que acaba de generar
        // MySQL para el turno nuevo.
        const idTurnoNuevo = resultado.insertId;

        // 2) Insertamos en "registra" quien es el medico.
        await conexion.execute(
            `INSERT INTO registra (matricula_medico, id_turno, id_disponibilidad)
             VALUES (?, ?, ?)`,
            [
                datos.matricula_medico,
                idTurnoNuevo,
                datos.id_disponibilidad
            ]
        );

        // Los dos inserts salieron bien: confirmamos.
        await conexion.commit();

        return idTurnoNuevo;

    } catch (error) {
        // Algo fallo: deshacemos TODO y dejamos la base como estaba.
        await conexion.rollback();
        throw error;

    } finally {
        // Pase lo que pase, devolvemos la conexion al pool.
        // Si no la liberamos, el pool se queda sin conexiones.
        conexion.release();
    }
}

// ============================================================
// FUNCION: reprogramarTurno
// ============================================================
// OBJETIVO DE LA FUNCION:
// Cambiar la fecha, la hora y la franja horaria de un turno.
// Esta es la MEJORA FUNCIONAL principal del parcial.
//
// REGLA DEL ENUNCIADO: si el turno estaba Confirmado y se
// reprograma, vuelve al estado Reservado y hay que confirmarlo
// de nuevo. Por eso tambien limpiamos fecha_confirmacion y
// medico_confirmacion.
//
// Tambien son dos tablas (turno y registra), asi que otra vez
// usamos transaccion.
async function reprogramarTurno(idTurno, datos) {

    const conexion = await db.getConnection();

    try {
        await conexion.beginTransaction();

        await conexion.execute(
            `UPDATE turno
             SET fecha_turno        = ?,
                 hora_turno         = ?,
                 id_disponibilidad  = ?,
                 estado_turno       = 'Reservado',
                 fecha_confirmacion = NULL,
                 medico_confirmacion = NULL
             WHERE id_turno = ?`,
            [
                datos.fecha_turno,
                datos.hora_turno,
                datos.id_disponibilidad,
                idTurno
            ]
        );

        // La franja horaria tambien esta guardada en "registra",
        // asi que la actualizamos para que los datos no queden
        // desincronizados entre las dos tablas.
        await conexion.execute(
            `UPDATE registra
             SET id_disponibilidad = ?
             WHERE id_turno = ?`,
            [datos.id_disponibilidad, idTurno]
        );

        await conexion.commit();
        return true;

    } catch (error) {
        await conexion.rollback();
        throw error;

    } finally {
        conexion.release();
    }
}

// ============================================================
// FUNCION: confirmarTurno
// ============================================================
// OBJETIVO DE LA FUNCION:
// Pasar el turno a Confirmado y registrar cuando se confirmo y
// que medico lo confirmo (columnas fecha_confirmacion y
// medico_confirmacion que ya existian en la tabla).
//
// NOW() es una funcion de MySQL que devuelve la fecha y hora
// del momento: la usamos para no depender del reloj del
// navegador del usuario.
async function confirmarTurno(idTurno, matriculaMedico) {
    const [resultado] = await db.execute(
        `UPDATE turno
         SET estado_turno        = 'Confirmado',
             fecha_confirmacion  = NOW(),
             medico_confirmacion = ?
         WHERE id_turno = ?`,
        [matriculaMedico || null, idTurno]
    );

    // affectedRows dice cuantas filas cambiaron. Si es 0, el id
    // no existia.
    return resultado.affectedRows === 1;
}

// ============================================================
// FUNCION: cancelarTurno
// ============================================================
// OBJETIVO DE LA FUNCION:
// Pasar el turno a Cancelado. No borramos la fila: el centro
// necesita el historial, y como las validaciones ignoran los
// turnos cancelados, ese horario queda libre otra vez.
async function cancelarTurno(idTurno) {
    const [resultado] = await db.execute(
        `UPDATE turno
         SET estado_turno = 'Cancelado'
         WHERE id_turno = ?`,
        [idTurno]
    );

    return resultado.affectedRows === 1;
}

// ============================================================
// FUNCION: eliminarTurno
// ============================================================
// OBJETIVO DE LA FUNCION:
// Borrar fisicamente el turno. Solo lo puede hacer el
// administrador.
// Primero hay que borrar la fila de "registra", porque tiene
// una clave foranea (FOREIGN KEY) que apunta al turno: si
// intentamos borrar el turno antes, MySQL lo rechaza.
async function eliminarTurno(idTurno) {

    const conexion = await db.getConnection();

    try {
        await conexion.beginTransaction();

        await conexion.execute(
            'DELETE FROM registra WHERE id_turno = ?',
            [idTurno]
        );

        const [resultado] = await conexion.execute(
            'DELETE FROM turno WHERE id_turno = ?',
            [idTurno]
        );

        await conexion.commit();
        return resultado.affectedRows === 1;

    } catch (error) {
        await conexion.rollback();
        throw error;

    } finally {
        conexion.release();
    }
}

module.exports = {
    buscarTurnos,
    obtenerTurnoPorId,
    crearTurno,
    reprogramarTurno,
    confirmarTurno,
    cancelarTurno,
    eliminarTurno
};
