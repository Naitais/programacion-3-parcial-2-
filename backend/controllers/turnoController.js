// ============================================================
// MODULO: controllers/turnoController.js
// ============================================================
// PARA QUE EXISTE:
// El controlador es el intermediario entre la ruta y el
// service. Su trabajo es:
//   1) leer los datos del pedido (req.params, req.query, req.body),
//   2) revisar permisos y reglas de negocio,
//   3) pedirle los datos al service,
//   4) armar la respuesta HTTP (codigo de estado + JSON).
//
// El controlador NO escribe SQL (eso es del service) y NO
// decide quien puede entrar a la ruta (eso es de los
// middlewares). Pero SI decide si este usuario puede tocar
// ESTE turno en particular, porque eso depende de los datos.
//
// COMO SE USA EN EL PROYECTO:
// Lo llaman las rutas de turnoRoutes.js:
//     router.get('/', turnoController.obtenerTurnos);
//
// CODIGOS HTTP QUE USAMOS:
//   200 OK                -> salio bien
//   201 Created           -> se creo algo nuevo
//   400 Bad Request       -> datos mal o regla de negocio no cumplida
//   401 Unauthorized      -> no estas identificado (falta token)
//   403 Forbidden         -> estas identificado pero no te corresponde
//   404 Not Found         -> no existe
//   409 Conflict          -> choca con algo que ya existe
//   500 Internal Error    -> se rompio el servidor
// ============================================================

const turnoService = require('../services/turnoService');
const { ROLES } = require('../config/roles');
const {
    validarReglasDeTurno,
    validarTurnoModificable
} = require('../validators/reglasTurno');

// ============================================================
// FUNCION AUXILIAR: filtrosSegunRol
// ============================================================
// OBJETIVO DE LA FUNCION:
// Armar los filtros de busqueda y, lo mas importante, FORZAR el
// filtro que corresponde al rol del usuario.
//
// Esta funcion es el corazon del control de acceso a los datos:
//   - El ADMIN ve todos los turnos.
//   - El PACIENTE ve solo los turnos de su propio DNI.
//   - El MEDICO ve solo los turnos en los que el es el medico.
//
// El dni y la matricula los sacamos del TOKEN (req.usuario), no
// de lo que mando el navegador. Si un paciente manda a mano
// ?dni_paciente=30100202 para espiar a otro, se lo sobreescribimos
// con el suyo y no ve nada ajeno.
function filtrosSegunRol(req) {

    // Filtros opcionales que puede elegir el usuario.
    const filtros = {
        fecha_desde: req.query.fecha_desde,
        fecha_hasta: req.query.fecha_hasta,
        estado: req.query.estado
    };

    const usuario = req.usuario;

    if (usuario.nombre_rol === ROLES.PACIENTE) {
        // Se ignora lo que pida: siempre su propio DNI.
        filtros.dni_paciente = usuario.dni_paciente;

    } else if (usuario.nombre_rol === ROLES.MEDICO) {
        // Siempre su propia matricula.
        filtros.matricula_medico = usuario.matricula_medico;

    } else {
        // El admin si puede filtrar por quien quiera.
        filtros.dni_paciente = req.query.dni_paciente;
        filtros.matricula_medico = req.query.matricula_medico;
    }

    return filtros;
}

// ============================================================
// FUNCION AUXILIAR: verificarQueElTurnoLeCorresponde
// ============================================================
// OBJETIVO DE LA FUNCION:
// Comprobar que el usuario tiene derecho a ver o tocar ESTE
// turno. Protege el caso que pide la consigna: que un usuario
// no pueda acceder a datos de otro perfil cambiando el numero
// en la direccion (por ejemplo /api/turnos/7).
//
// Devuelve null si le corresponde, o { estado, mensaje } si no.
function verificarQueElTurnoLeCorresponde(usuario, turno) {

    // El administrador puede con todo.
    if (usuario.nombre_rol === ROLES.ADMIN) {
        return null;
    }

    // El paciente solo sus turnos.
    if (usuario.nombre_rol === ROLES.PACIENTE) {
        if (Number(turno.dni_paciente) !== Number(usuario.dni_paciente)) {
            return {
                estado: 403,
                mensaje: 'Ese turno no te pertenece'
            };
        }
        return null;
    }

    // El medico solo los turnos donde el atiende.
    if (usuario.nombre_rol === ROLES.MEDICO) {
        if (Number(turno.matricula_medico) !== Number(usuario.matricula_medico)) {
            return {
                estado: 403,
                mensaje: 'Ese turno no corresponde a tu agenda'
            };
        }
        return null;
    }

    // Cualquier otro caso: por seguridad, no.
    return { estado: 403, mensaje: 'No tenes permiso sobre ese turno' };
}

// ============================================================
// OBTENER TURNOS (con filtros y segun el rol)
// ============================================================
// OBJETIVO: devolver la lista de turnos que le corresponde ver
// al usuario que inicio sesion, aplicando los filtros pedidos.
async function obtenerTurnos(req, res, next) {
    try {
        const filtros = filtrosSegunRol(req);
        const turnos = await turnoService.buscarTurnos(filtros);

        res.json({
            total: turnos.length,
            turnos: turnos
        });

    } catch (error) {
        // En vez de repetir el mismo res.status(500) en cada
        // controlador, le pasamos el error al manejador
        // centralizado (middlewares/manejadorErrores.js).
        next(error);
    }
}

// ============================================================
// OBTENER UN TURNO POR ID
// ============================================================
// OBJETIVO: devolver un turno puntual, solo si le corresponde
// al usuario.
async function obtenerTurnoPorId(req, res, next) {
    try {
        const turno = await turnoService.obtenerTurnoPorId(req.params.id);

        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }

        // Control de acceso a nivel del dato.
        const problema = verificarQueElTurnoLeCorresponde(req.usuario, turno);
        if (problema) {
            return res.status(problema.estado).json({ error: problema.mensaje });
        }

        res.json(turno);

    } catch (error) {
        next(error);
    }
}

// ============================================================
// CREAR TURNO
// ============================================================
// OBJETIVO: dar de alta un turno nuevo despues de pasar todas
// las reglas de negocio.
//
// Antes de llegar aca, el pedido ya paso por:
//   verificarToken     -> hay sesion valida
//   autorizarRol       -> el rol puede crear turnos
//   validarTurno       -> los datos tienen la forma correcta
async function crearTurno(req, res, next) {
    try {
        const datos = { ...req.body };

        // Si el que pide el turno es un paciente, lo pedimos
        // SIEMPRE para el mismo. Asi no puede cargar turnos a
        // nombre de otra persona mandando otro dni en el JSON.
        if (req.usuario.nombre_rol === ROLES.PACIENTE) {
            datos.dni_paciente = req.usuario.dni_paciente;
        }

        // Reglas de negocio contra la base de datos.
        const problema = await validarReglasDeTurno(datos);
        if (problema) {
            return res.status(problema.estado).json({ error: problema.mensaje });
        }

        const idNuevo = await turnoService.crearTurno(datos);

        // 201 = creado. Devolvemos el turno completo para que el
        // frontend pueda mostrarlo sin pedirlo de nuevo.
        const turnoCreado = await turnoService.obtenerTurnoPorId(idNuevo);

        res.status(201).json({
            mensaje: 'Turno creado correctamente',
            turno: turnoCreado
        });

    } catch (error) {
        next(error);
    }
}

// ============================================================
// REPROGRAMAR TURNO  (mejora funcional principal)
// ============================================================
// OBJETIVO: cambiar fecha, hora y franja horaria de un turno
// que ya existe, volviendo a aplicar TODAS las validaciones.
//
// Pasos:
//   1) buscar el turno
//   2) ver si le corresponde al usuario
//   3) ver que no este cancelado
//   4) validar las reglas con los datos NUEVOS
//   5) guardar
async function reprogramarTurno(req, res, next) {
    try {
        const idTurno = req.params.id;
        const turno = await turnoService.obtenerTurnoPorId(idTurno);

        // 1 y 2) existe y es suyo
        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }

        const problemaPermiso = verificarQueElTurnoLeCorresponde(req.usuario, turno);
        if (problemaPermiso) {
            return res.status(problemaPermiso.estado).json({
                error: problemaPermiso.mensaje
            });
        }

        // 3) un turno cancelado no se reprograma
        const problemaEstado = validarTurnoModificable(turno, 'reprogramar');
        if (problemaEstado) {
            return res.status(problemaEstado.estado).json({
                error: problemaEstado.mensaje
            });
        }

        // 4) validamos con la fecha y hora nuevas, pero
        //    manteniendo el paciente, la practica, el medico y el
        //    equipo que ya tenia el turno.
        const datosNuevos = {
            fecha_turno: req.body.fecha_turno,
            hora_turno: req.body.hora_turno,
            id_disponibilidad: req.body.id_disponibilidad,
            dni_paciente: turno.dni_paciente,
            matricula_medico: turno.matricula_medico,
            id_practica: turno.id_practica,
            id_equipo: turno.id_equipo,
            // Clave: le decimos que ignore este mismo turno al
            // buscar superposiciones, si no choca consigo mismo.
            idTurnoExcluir: idTurno
        };

        const problemaReglas = await validarReglasDeTurno(datosNuevos);
        if (problemaReglas) {
            return res.status(problemaReglas.estado).json({
                error: problemaReglas.mensaje
            });
        }

        // 5) guardamos
        await turnoService.reprogramarTurno(idTurno, datosNuevos);

        const turnoActualizado = await turnoService.obtenerTurnoPorId(idTurno);

        res.json({
            mensaje: 'Turno reprogramado. Queda en estado Reservado y hay que confirmarlo de nuevo',
            turno: turnoActualizado
        });

    } catch (error) {
        next(error);
    }
}

// ============================================================
// CONFIRMAR TURNO
// ============================================================
// OBJETIVO: pasar un turno de Reservado a Confirmado y dejar
// registrado cuando y quien lo confirmo.
async function confirmarTurno(req, res, next) {
    try {
        const idTurno = req.params.id;
        const turno = await turnoService.obtenerTurnoPorId(idTurno);

        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }

        const problemaPermiso = verificarQueElTurnoLeCorresponde(req.usuario, turno);
        if (problemaPermiso) {
            return res.status(problemaPermiso.estado).json({
                error: problemaPermiso.mensaje
            });
        }

        // Un turno cancelado no se puede confirmar.
        const problemaEstado = validarTurnoModificable(turno, 'confirmar');
        if (problemaEstado) {
            return res.status(problemaEstado.estado).json({
                error: problemaEstado.mensaje
            });
        }

        // Si ya estaba confirmado, no tiene sentido repetirlo.
        if (turno.estado_turno === 'Confirmado') {
            return res.status(409).json({
                error: 'El turno ya estaba confirmado'
            });
        }

        // Quien confirma: si lo hace el medico, su matricula.
        // Si lo hace el administrador, queda el medico del turno.
        const matriculaQueConfirma =
            req.usuario.nombre_rol === ROLES.MEDICO
                ? req.usuario.matricula_medico
                : turno.matricula_medico;

        await turnoService.confirmarTurno(idTurno, matriculaQueConfirma);

        res.json({
            mensaje: 'Turno confirmado correctamente',
            turno: await turnoService.obtenerTurnoPorId(idTurno)
        });

    } catch (error) {
        next(error);
    }
}

// ============================================================
// CANCELAR TURNO
// ============================================================
// OBJETIVO: pasar el turno a Cancelado para que su horario
// quede libre otra vez, sin borrar el historial.
async function cancelarTurno(req, res, next) {
    try {
        const idTurno = req.params.id;
        const turno = await turnoService.obtenerTurnoPorId(idTurno);

        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }

        const problemaPermiso = verificarQueElTurnoLeCorresponde(req.usuario, turno);
        if (problemaPermiso) {
            return res.status(problemaPermiso.estado).json({
                error: problemaPermiso.mensaje
            });
        }

        // Si ya estaba cancelado, avisamos en vez de hacer de
        // nuevo el UPDATE.
        const problemaEstado = validarTurnoModificable(turno, 'cancelar de nuevo');
        if (problemaEstado) {
            return res.status(problemaEstado.estado).json({
                error: problemaEstado.mensaje
            });
        }

        await turnoService.cancelarTurno(idTurno);

        res.json({
            mensaje: 'Turno cancelado correctamente',
            turno: await turnoService.obtenerTurnoPorId(idTurno)
        });

    } catch (error) {
        next(error);
    }
}

// ============================================================
// ELIMINAR TURNO (solo administrador)
// ============================================================
// OBJETIVO: borrar el turno de la base. El permiso de rol ya lo
// controla la ruta con autorizarRol(ROLES.ADMIN).
async function eliminarTurno(req, res, next) {
    try {
        const turno = await turnoService.obtenerTurnoPorId(req.params.id);

        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }

        await turnoService.eliminarTurno(req.params.id);

        res.json({ mensaje: 'Turno eliminado correctamente' });

    } catch (error) {
        next(error);
    }
}

module.exports = {
    obtenerTurnos,
    obtenerTurnoPorId,
    crearTurno,
    reprogramarTurno,
    confirmarTurno,
    cancelarTurno,
    eliminarTurno
};
