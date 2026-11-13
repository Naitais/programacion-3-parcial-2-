// ============================================================
// MODULO: controllers/pacienteController.js
// ============================================================
// PARA QUE EXISTE:
// Atiende las operaciones sobre pacientes: listarlos, ver uno
// y actualizar sus datos de contacto.
// Cubre el "completar o mejorar una operacion CRUD" del parcial
// y la regla del enunciado original: cuando el paciente se
// presenta en el centro, recepcion verifica y completa sus datos.
//
// COMO SE USA EN EL PROYECTO:
// - El admin lista pacientes para cargar un turno.
// - El paciente ve y corrige sus propios datos.
//
// CONTROL DE ACCESO:
// Un paciente solo puede ver y modificar SU ficha. Lo
// comprobamos comparando el DNI de la direccion con el DNI que
// viene dentro del token.
// ============================================================

const pacienteService = require('../services/pacienteService');
const { ROLES } = require('../config/roles');

// ============================================================
// FUNCION AUXILIAR: puedeVerEstePaciente
// ============================================================
// OBJETIVO DE LA FUNCION:
// Decidir si el usuario del token puede trabajar con la ficha
// de ese DNI. El admin y el medico pueden ver pacientes; el
// paciente solo el suyo.
function puedeVerEstePaciente(usuario, dniPedido) {

    if (usuario.nombre_rol === ROLES.ADMIN) {
        return true;
    }

    if (usuario.nombre_rol === ROLES.MEDICO) {
        // El medico necesita ver los datos de contacto para
        // poder llamar al paciente y confirmar el turno.
        return true;
    }

    // Paciente: solo su propia ficha.
    return Number(usuario.dni_paciente) === Number(dniPedido);
}

// ============================================================
// LISTAR PACIENTES
// ============================================================
// OBJETIVO: devolver la lista de pacientes, con busqueda
// opcional por nombre, apellido o DNI (?texto=perez).
async function obtenerPacientes(req, res, next) {
    try {
        const pacientes = await pacienteService.listarPacientes(req.query.texto);

        res.json({
            total: pacientes.length,
            pacientes: pacientes
        });

    } catch (error) {
        next(error);
    }
}

// ============================================================
// OBTENER UN PACIENTE POR DNI
// ============================================================
// OBJETIVO: devolver la ficha de un paciente si el usuario
// tiene derecho a verla.
async function obtenerPacientePorDni(req, res, next) {
    try {
        const dni = req.params.dni;

        if (!puedeVerEstePaciente(req.usuario, dni)) {
            return res.status(403).json({
                error: 'Solo podes consultar tus propios datos'
            });
        }

        const paciente = await pacienteService.obtenerPacientePorDni(dni);

        if (!paciente) {
            return res.status(404).json({ error: 'Paciente no encontrado' });
        }

        res.json(paciente);

    } catch (error) {
        next(error);
    }
}

// ============================================================
// ACTUALIZAR DATOS DE CONTACTO
// ============================================================
// OBJETIVO: completar o corregir el telefono y el email del
// paciente, validando el formato antes de guardar.
async function actualizarPaciente(req, res, next) {
    try {
        const dni = req.params.dni;

        // El medico puede ver, pero no modificar fichas.
        if (req.usuario.nombre_rol === ROLES.MEDICO) {
            return res.status(403).json({
                error: 'El perfil medico no puede modificar datos de pacientes'
            });
        }

        if (!puedeVerEstePaciente(req.usuario, dni)) {
            return res.status(403).json({
                error: 'Solo podes modificar tus propios datos'
            });
        }

        const paciente = await pacienteService.obtenerPacientePorDni(dni);

        if (!paciente) {
            return res.status(404).json({ error: 'Paciente no encontrado' });
        }

        const { tel_paciente, email_paciente } = req.body;

        // VALIDACION: al menos un dato para actualizar.
        if (!tel_paciente && !email_paciente) {
            return res.status(400).json({
                error: 'Hay que completar el telefono o el email'
            });
        }

        // VALIDACION: formato de email.
        // La expresion regular pide: algo, arroba, algo, punto, algo.
        if (email_paciente && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_paciente)) {
            return res.status(400).json({
                error: 'El email no tiene un formato valido'
            });
        }

        // VALIDACION: el telefono entra en la columna (15 caracteres).
        if (tel_paciente && String(tel_paciente).length > 15) {
            return res.status(400).json({
                error: 'El telefono no puede tener mas de 15 caracteres'
            });
        }

        await pacienteService.actualizarContacto(dni, {
            tel_paciente: tel_paciente || paciente.tel_paciente,
            email_paciente: email_paciente || paciente.email_paciente
        });

        res.json({
            mensaje: 'Datos del paciente actualizados correctamente',
            paciente: await pacienteService.obtenerPacientePorDni(dni)
        });

    } catch (error) {
        next(error);
    }
}

module.exports = {
    obtenerPacientes,
    obtenerPacientePorDni,
    actualizarPaciente
};
