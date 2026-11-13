// ============================================================
// MODULO: validators/turnoValidator.js
// ============================================================
// PARA QUE EXISTE:
// Es el primer filtro de los datos que llegan del frontend.
// Revisa SOLO la forma de los datos: que esten todos los
// campos obligatorios, que la fecha parezca una fecha, que el
// estado sea uno de los tres permitidos, etc.
// NO toca la base de datos. Es un control rapido y barato.
//
// Si los datos estan mal, corta el pedido con 400
// (Bad Request = "me mandaste cualquier cosa").
//
// COMO SE USA EN EL PROYECTO:
// Como middleware, en el medio de la ruta:
//     router.post('/', validarTurno, turnoController.crearTurno);
// Si validarTurno llama a next(), recien entonces se ejecuta el
// controlador. Si responde con error, el controlador nunca corre.
//
// POR QUE SEPARADO DE reglasTurno.js:
// Aca van los controles que se pueden hacer "mirando el papel".
// En reglasTurno.js van las reglas que necesitan preguntarle a
// la base (si el medico existe, si el horario esta ocupado...).
// ============================================================

// Los unicos tres estados que acepta el sistema.
// Antes se podia insertar cualquier texto en estado_turno
// (la columna es varchar): esta lista lo evita.
const ESTADOS_VALIDOS = ['Reservado', 'Confirmado', 'Cancelado'];

// Medios por los que el paciente puede pedir el turno.
const MEDIOS_VALIDOS = ['Web', 'Telefono', 'Teléfono', 'Email', 'WhatsApp', 'Presencial'];

// OBJETIVO DE LA FUNCION:
// Dejar la hora siempre en formato HH:MM:SS.
// El input <input type="time"> del HTML manda "09:30" y MySQL
// quiere "09:30:00". Esta funcion arregla esa diferencia.
function normalizarHora(hora) {
    if (typeof hora !== 'string') {
        return hora;
    }
    // Si vino "09:30" le agregamos los segundos.
    return hora.length === 5 ? `${hora}:00` : hora;
}

// OBJETIVO DE LA FUNCION:
// Middleware que valida el cuerpo del pedido al CREAR un turno.
function validarTurno(req, res, next) {

    // Si el que pide es un PACIENTE, el turno siempre es para el.
    // Usamos el DNI que viene DENTRO DEL TOKEN (no el del navegador),
    // asi no hace falta mandarlo y no se puede sacar turno para otro.
    if (req.usuario && req.usuario.nombre_rol === 'PACIENTE') {
        req.body.dni_paciente = req.usuario.dni_paciente;
    }

    // Sacamos del cuerpo del pedido lo que nos interesa.
    const {
        fecha_turno,
        hora_turno,
        medio_solicitado,
        estado_turno,
        dni_paciente,
        matricula_medico,
        id_practica,
        id_equipo,
        id_disponibilidad
    } = req.body;

    // Vamos juntando todos los errores en un array para
    // devolverlos todos juntos (mejor que de uno en uno).
    const errores = [];

    // ---- VALIDACION A: campos obligatorios completos -------
    if (!fecha_turno) errores.push('La fecha del turno es obligatoria');
    if (!hora_turno) errores.push('La hora del turno es obligatoria');
    if (!dni_paciente) errores.push('El DNI del paciente es obligatorio');
    if (!matricula_medico) errores.push('La matricula del medico es obligatoria');
    if (!id_practica) errores.push('La practica es obligatoria');
    if (!id_disponibilidad) errores.push('La franja horaria del medico es obligatoria');

    // ---- VALIDACION B: formato de fecha y hora -------------
    // La expresion regular pide 4 digitos, guion, 2 digitos,
    // guion, 2 digitos. Ejemplo: 2026-11-20
    if (fecha_turno && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_turno)) {
        errores.push('La fecha debe tener el formato AAAA-MM-DD');
    }

    if (hora_turno && !/^\d{2}:\d{2}(:\d{2})?$/.test(hora_turno)) {
        errores.push('La hora debe tener el formato HH:MM');
    }

    // ---- VALIDACION C: estado permitido --------------------
    // Si no mandan estado, mas adelante se guarda "Reservado".
    if (estado_turno && !ESTADOS_VALIDOS.includes(estado_turno)) {
        errores.push(
            `El estado debe ser uno de estos: ${ESTADOS_VALIDOS.join(', ')}`
        );
    }

    // ---- VALIDACION D: medio de solicitud permitido -------
    if (medio_solicitado && !MEDIOS_VALIDOS.includes(medio_solicitado)) {
        errores.push(
            `El medio solicitado debe ser uno de estos: ${MEDIOS_VALIDOS.join(', ')}`
        );
    }

    // ---- VALIDACION E: los numeros son numeros ------------
    // Number('abc') da NaN (Not a Number), asi detectamos
    // cuando alguien manda texto donde va un numero.
    const camposNumericos = {
        dni_paciente,
        matricula_medico,
        id_practica,
        id_disponibilidad
    };

    for (const nombre in camposNumericos) {
        const valor = camposNumericos[nombre];
        if (valor !== undefined && valor !== null && isNaN(Number(valor))) {
            errores.push(`El campo ${nombre} tiene que ser un numero`);
        }
    }

    // id_equipo es opcional (hay practicas que no usan equipo),
    // pero si lo mandan tiene que ser un numero.
    if (id_equipo !== undefined && id_equipo !== null && id_equipo !== '' && isNaN(Number(id_equipo))) {
        errores.push('El campo id_equipo tiene que ser un numero');
    }

    // ---- RESULTADO ---------------------------------------
    if (errores.length > 0) {
        return res.status(400).json({
            error: errores[0],      // el primero, para mostrarlo facil
            errores: errores        // la lista completa
        });
    }

    // Datos con forma correcta: dejamos la hora normalizada y
    // seguimos hacia el controlador.
    req.body.hora_turno = normalizarHora(hora_turno);
    next();
}

// OBJETIVO DE LA FUNCION:
// Middleware que valida el cuerpo del pedido al REPROGRAMAR.
// Al reprogramar solo se cambian fecha, hora y franja horaria,
// asi que pedimos menos campos que al crear.
function validarReprogramacion(req, res, next) {
    const { fecha_turno, hora_turno, id_disponibilidad } = req.body;
    const errores = [];

    if (!fecha_turno) errores.push('La nueva fecha es obligatoria');
    if (!hora_turno) errores.push('La nueva hora es obligatoria');
    if (!id_disponibilidad) errores.push('Hay que elegir la franja horaria del medico');

    if (fecha_turno && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_turno)) {
        errores.push('La fecha debe tener el formato AAAA-MM-DD');
    }

    if (hora_turno && !/^\d{2}:\d{2}(:\d{2})?$/.test(hora_turno)) {
        errores.push('La hora debe tener el formato HH:MM');
    }

    if (errores.length > 0) {
        return res.status(400).json({
            error: errores[0],
            errores: errores
        });
    }

    req.body.hora_turno = normalizarHora(hora_turno);
    next();
}

module.exports = {
    validarTurno,
    validarReprogramacion,
    normalizarHora,
    ESTADOS_VALIDOS
};
