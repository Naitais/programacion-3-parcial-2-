// ============================================================
// MODULO: validators/reglasTurno.js
// ============================================================
// PARA QUE EXISTE:
// Aca estan TODAS las reglas de negocio del turno, es decir las
// validaciones que no se pueden hacer mirando solo el formulario
// porque hay que preguntarle a la base de datos.
// Es el archivo mas importante del punto A del parcial.
//
// COMO SE USA EN EL PROYECTO:
// Lo llaman los controladores antes de guardar o modificar:
//
//     const problema = await validarReglasDeTurno({ ... });
//     if (problema) {
//         return res.status(problema.estado).json({ error: problema.mensaje });
//     }
//
// Si devuelve null, significa "todo bien, se puede guardar".
// Si devuelve un objeto, trae el mensaje para el usuario y el
// codigo HTTP que corresponde.
//
// POR QUE EN EL BACKEND Y NO SOLO EN EL FRONTEND:
// Porque el frontend se puede saltear. Cualquiera puede mandar
// un pedido con Thunder Client directo a la API. El frontend
// valida para dar una buena experiencia; el backend valida
// porque es el unico lugar seguro.
// ============================================================

const db = require('../config/database');

// ------------------------------------------------------------
// HORARIO DE ATENCION DEL CENTRO
// ------------------------------------------------------------
// El indice del array es el numero de dia que devuelve
// JavaScript con getDay(): 0 = Domingo ... 6 = Sabado.
// null significa cerrado.
const HORARIOS_CENTRO = [
    null,                               // 0 Domingo: cerrado
    { desde: '08:00', hasta: '20:00' }, // 1 Lunes
    { desde: '08:00', hasta: '20:00' }, // 2 Martes
    { desde: '08:00', hasta: '20:00' }, // 3 Miercoles
    { desde: '08:00', hasta: '20:00' }, // 4 Jueves
    { desde: '08:00', hasta: '20:00' }, // 5 Viernes
    { desde: '08:00', hasta: '14:00' }  // 6 Sabado
];

// Nombres de los dias como estan escritos en la tabla
// disponibilidad ("Lunes", "Martes", ...).
const NOMBRES_DIAS = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles',
    'Jueves', 'Viernes', 'Sábado'
];

// ------------------------------------------------------------
// FUNCIONES AUXILIARES DE HORA
// ------------------------------------------------------------
// Trabajar las horas como minutos (numeros) es mucho mas simple
// que trabajarlas como texto: se pueden comparar y sumar.

// OBJETIVO: pasar "09:30:00" a 570 (9 * 60 + 30).
function horaAMinutos(hora) {
    const partes = String(hora).split(':');
    return Number(partes[0]) * 60 + Number(partes[1]);
}

// OBJETIVO: pasar 570 a "09:30:00".
function minutosAHora(totalMinutos) {
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    return (
        String(horas).padStart(2, '0') + ':' +
        String(minutos).padStart(2, '0') + ':00'
    );
}

// OBJETIVO: devolver la hora en que termina el turno.
// Si empieza 09:30 y la practica dura 45 minutos -> "10:15:00".
function calcularHoraFin(horaInicio, duracionMinutos) {
    return minutosAHora(horaAMinutos(horaInicio) + Number(duracionMinutos));
}

// OBJETIVO: devolver la fecha de hoy como "AAAA-MM-DD" usando
// la hora LOCAL de la computadora.
// Ojo: no usamos toISOString() porque esa funcion convierte a
// UTC y en Argentina (UTC-3) nos puede devolver el dia anterior.
function fechaDeHoy() {
    const ahora = new Date();
    return (
        ahora.getFullYear() + '-' +
        String(ahora.getMonth() + 1).padStart(2, '0') + '-' +
        String(ahora.getDate()).padStart(2, '0')
    );
}

// OBJETIVO: devolver la hora actual como "HH:MM:SS".
function horaDeAhora() {
    const ahora = new Date();
    return (
        String(ahora.getHours()).padStart(2, '0') + ':' +
        String(ahora.getMinutes()).padStart(2, '0') + ':00'
    );
}

// ============================================================
// FUNCION PRINCIPAL: validarReglasDeTurno
// ============================================================
// OBJETIVO DE LA FUNCION:
// Revisar una por una las reglas del negocio para un turno que
// se quiere crear o reprogramar.
// Devuelve null si todo esta bien, o { estado, mensaje } con el
// primer problema que encuentra.
//
// PARAMETROS:
//   datos.fecha_turno        -> "2026-11-20"
//   datos.hora_turno         -> "09:30:00"
//   datos.dni_paciente       -> 30100101
//   datos.matricula_medico   -> 1001
//   datos.id_practica        -> 3
//   datos.id_equipo          -> 1  (puede venir vacio)
//   datos.id_disponibilidad  -> 5
//   datos.idTurnoExcluir     -> id del turno que estoy editando,
//                               para que no choque consigo mismo
// ============================================================
async function validarReglasDeTurno(datos) {

    const fecha = datos.fecha_turno;
    const hora = datos.hora_turno;
    const dniPaciente = Number(datos.dni_paciente);
    const matriculaMedico = Number(datos.matricula_medico);
    const idPractica = Number(datos.id_practica);
    const idDisponibilidad = Number(datos.id_disponibilidad);

    // Si no hay equipo lo dejamos en null (hay practicas, como
    // una consulta, que no usan ningun equipo).
    const idEquipo = datos.id_equipo ? Number(datos.id_equipo) : null;

    // Cuando reprogramamos un turno, ese turno ya esta guardado
    // en la base. Si no lo excluimos de las busquedas, el
    // sistema diria "el horario esta ocupado"... por el mismo
    // turno que estoy moviendo. Usamos 0 porque ningun turno
    // tiene id 0.
    const idTurnoExcluir = datos.idTurnoExcluir ? Number(datos.idTurnoExcluir) : 0;

    // ========================================================
    // REGLA 1: la fecha y hora no pueden ser anteriores a ahora
    // ========================================================
    // Comparamos textos con formato AAAA-MM-DD, que se ordenan
    // igual que las fechas ("2026-11-12" < "2026-11-13").
    const hoy = fechaDeHoy();

    if (fecha < hoy) {
        return {
            estado: 400,
            mensaje: 'No se pueden asignar turnos en fechas anteriores a hoy'
        };
    }

    // Si el turno es HOY, la hora tampoco puede haber pasado.
    if (fecha === hoy && hora <= horaDeAhora()) {
        return {
            estado: 400,
            mensaje: 'La hora del turno ya paso. Elegi un horario posterior'
        };
    }

    // ========================================================
    // REGLA 2: la practica tiene que existir (y necesitamos su
    // duracion para todas las comparaciones de horarios)
    // ========================================================
    const [practicas] = await db.execute(
        `SELECT id_practica, nombre_practica, duracion, id_servicio
         FROM practica
         WHERE id_practica = ?`,
        [idPractica]
    );

    if (practicas.length === 0) {
        return { estado: 404, mensaje: 'La practica solicitada no existe' };
    }

    const practica = practicas[0];
    const duracion = Number(practica.duracion);

    // La hora en que termina este turno.
    const horaFin = calcularHoraFin(hora, duracion);

    // ========================================================
    // REGLA 3: el turno tiene que entrar en el horario del centro
    // ========================================================
    // Lunes a viernes de 8 a 20, sabados de 8 a 14, domingos cerrado.
    //
    // Creamos la fecha con "T00:00:00" para que JavaScript la
    // interprete como hora local y no como UTC.
    const fechaComoObjeto = new Date(`${fecha}T00:00:00`);
    const numeroDeDia = fechaComoObjeto.getDay();   // 0 a 6
    const horarioDelDia = HORARIOS_CENTRO[numeroDeDia];

    if (!horarioDelDia) {
        return {
            estado: 400,
            mensaje: 'El centro no atiende los domingos'
        };
    }

    // El turno tiene que empezar despues de la apertura...
    if (horaAMinutos(hora) < horaAMinutos(horarioDelDia.desde)) {
        return {
            estado: 400,
            mensaje: `Ese dia el centro abre a las ${horarioDelDia.desde}`
        };
    }

    // ...y tiene que TERMINAR antes del cierre.
    if (horaAMinutos(horaFin) > horaAMinutos(horarioDelDia.hasta)) {
        return {
            estado: 400,
            mensaje:
                `El turno terminaria a las ${horaFin.slice(0, 5)} y ese dia ` +
                `el centro cierra a las ${horarioDelDia.hasta}`
        };
    }

    // ========================================================
    // REGLA 4: el paciente tiene que estar registrado
    // ========================================================
    const [pacientes] = await db.execute(
        `SELECT dni_paciente FROM paciente WHERE dni_paciente = ?`,
        [dniPaciente]
    );

    if (pacientes.length === 0) {
        return {
            estado: 404,
            mensaje: 'El paciente no esta registrado en el sistema'
        };
    }

    // ========================================================
    // REGLA 5: el medico tiene que existir y poder realizar
    //          la practica solicitada
    // ========================================================
    // La tabla practica_medico dice que practicas sabe hacer
    // cada medico. Si no hay fila, no esta habilitado.
    const [medicos] = await db.execute(
        `SELECT matricula_medico FROM medico WHERE matricula_medico = ?`,
        [matriculaMedico]
    );

    if (medicos.length === 0) {
        return { estado: 404, mensaje: 'El medico no existe' };
    }

    const [habilitado] = await db.execute(
        `SELECT 1
         FROM practica_medico
         WHERE matricula_medico = ? AND id_practica = ?`,
        [matriculaMedico, idPractica]
    );

    if (habilitado.length === 0) {
        return {
            estado: 400,
            mensaje: `El medico no realiza la practica "${practica.nombre_practica}"`
        };
    }

    // ========================================================
    // REGLA 6: el equipo tiene que ser compatible con la practica
    // ========================================================
    // La tabla practica_equipo dice en que equipos se puede
    // hacer cada practica.
    if (idEquipo) {
        const [compatible] = await db.execute(
            `SELECT 1
             FROM practica_equipo
             WHERE id_practica = ? AND id_equipo = ?`,
            [idPractica, idEquipo]
        );

        if (compatible.length === 0) {
            return {
                estado: 400,
                mensaje: `El equipo elegido no sirve para la practica "${practica.nombre_practica}"`
            };
        }
    }

    // ========================================================
    // REGLA 7: el medico tiene que estar disponible ese dia y
    //          en esa franja horaria
    // ========================================================
    // medico_disponibilidad dice que franjas tiene cada medico.
    // disponibilidad guarda el dia y el rango (hora_desde/hasta).
    const [franjas] = await db.execute(
        `SELECT d.dia, d.hora_desde, d.hora_hasta
         FROM medico_disponibilidad md
         JOIN disponibilidad d
              ON d.id_disponibilidad = md.id_disponibilidad
         WHERE md.matricula_medico = ?
           AND md.id_disponibilidad = ?`,
        [matriculaMedico, idDisponibilidad]
    );

    if (franjas.length === 0) {
        return {
            estado: 400,
            mensaje: 'Esa franja horaria no corresponde al medico elegido'
        };
    }

    const franja = franjas[0];

    // El dia de la franja ("Lunes") tiene que coincidir con el
    // dia de la semana de la fecha elegida.
    const nombreDelDia = NOMBRES_DIAS[numeroDeDia];

    if (franja.dia !== nombreDelDia) {
        return {
            estado: 400,
            mensaje: `El medico atiende los ${franja.dia} y elegiste un ${nombreDelDia}`
        };
    }

    // Y el turno completo tiene que entrar dentro de la franja.
    if (
        horaAMinutos(hora) < horaAMinutos(franja.hora_desde) ||
        horaAMinutos(horaFin) > horaAMinutos(franja.hora_hasta)
    ) {
        return {
            estado: 400,
            mensaje:
                `El medico atiende de ${String(franja.hora_desde).slice(0, 5)} ` +
                `a ${String(franja.hora_hasta).slice(0, 5)} ese dia`
        };
    }

    // ========================================================
    // REGLA 8: el MEDICO no puede tener otro turno superpuesto
    // ========================================================
    // COMO SE DETECTA UNA SUPERPOSICION:
    // Dos turnos se pisan si uno empieza antes de que termine
    // el otro Y el otro empieza antes de que termine el primero:
    //
    //     inicioNuevo < finViejo  Y  inicioViejo < finNuevo
    //
    // Los turnos Cancelados no cuentan, porque su horario
    // volvio a estar libre.
    //
    // El medico del turno se guarda en la tabla "registra",
    // por eso hacemos el JOIN con ella.
    const [choqueMedico] = await db.execute(
        `SELECT t.id_turno, t.hora_turno
         FROM turno t
         JOIN registra r   ON r.id_turno = t.id_turno
         JOIN practica pr  ON pr.id_practica = t.id_practica
         WHERE r.matricula_medico = ?
           AND t.fecha_turno = ?
           AND t.estado_turno <> 'Cancelado'
           AND t.id_turno <> ?
           AND ? < ADDTIME(t.hora_turno, SEC_TO_TIME(pr.duracion * 60))
           AND t.hora_turno < ?
         LIMIT 1`,
        [matriculaMedico, fecha, idTurnoExcluir, hora, horaFin]
    );

    if (choqueMedico.length > 0) {
        return {
            estado: 409,     // 409 Conflict = choca con algo que ya existe
            mensaje:
                `El medico ya tiene un turno a las ` +
                `${String(choqueMedico[0].hora_turno).slice(0, 5)} ese dia`
        };
    }

    // ========================================================
    // REGLA 9: el PACIENTE no puede tener dos turnos superpuestos
    // ========================================================
    const [choquePaciente] = await db.execute(
        `SELECT t.id_turno, t.hora_turno
         FROM turno t
         JOIN practica pr ON pr.id_practica = t.id_practica
         WHERE t.dni_paciente = ?
           AND t.fecha_turno = ?
           AND t.estado_turno <> 'Cancelado'
           AND t.id_turno <> ?
           AND ? < ADDTIME(t.hora_turno, SEC_TO_TIME(pr.duracion * 60))
           AND t.hora_turno < ?
         LIMIT 1`,
        [dniPaciente, fecha, idTurnoExcluir, hora, horaFin]
    );

    if (choquePaciente.length > 0) {
        return {
            estado: 409,
            mensaje:
                `El paciente ya tiene otro turno a las ` +
                `${String(choquePaciente[0].hora_turno).slice(0, 5)} ese dia`
        };
    }

    // ========================================================
    // REGLA 10: el EQUIPO no puede estar ocupado
    // ========================================================
    if (idEquipo) {
        const [choqueEquipo] = await db.execute(
            `SELECT t.id_turno, t.hora_turno
             FROM turno t
             JOIN practica pr ON pr.id_practica = t.id_practica
             WHERE t.id_equipo = ?
               AND t.fecha_turno = ?
               AND t.estado_turno <> 'Cancelado'
               AND t.id_turno <> ?
               AND ? < ADDTIME(t.hora_turno, SEC_TO_TIME(pr.duracion * 60))
               AND t.hora_turno < ?
             LIMIT 1`,
            [idEquipo, fecha, idTurnoExcluir, hora, horaFin]
        );

        if (choqueEquipo.length > 0) {
            return {
                estado: 409,
                mensaje:
                    `El equipo ya esta ocupado a las ` +
                    `${String(choqueEquipo[0].hora_turno).slice(0, 5)} ese dia`
            };
        }
    }

    // Paso todas las reglas.
    return null;
}

// ============================================================
// FUNCION: validarTurnoModificable
// ============================================================
// OBJETIVO DE LA FUNCION:
// Impedir que se toque un turno que ya fue cancelado.
// Es una de las validaciones que pide la consigna.
// Un turno cancelado es historia: no se reprograma, no se
// confirma y no se vuelve a cancelar.
//
// Devuelve null si se puede modificar, o { estado, mensaje }.
function validarTurnoModificable(turno, accion) {
    if (!turno) {
        return { estado: 404, mensaje: 'El turno no existe' };
    }

    if (turno.estado_turno === 'Cancelado') {
        return {
            estado: 409,
            mensaje: `El turno esta cancelado y no se puede ${accion}`
        };
    }

    return null;
}

module.exports = {
    validarReglasDeTurno,
    validarTurnoModificable,
    calcularHoraFin,
    fechaDeHoy,
    HORARIOS_CENTRO
};
