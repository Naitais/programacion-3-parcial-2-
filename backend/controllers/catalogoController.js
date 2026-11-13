// ============================================================
// MODULO: controllers/catalogoController.js
// ============================================================
// PARA QUE EXISTE:
// Responde las listas que necesita el formulario del frontend
// (practicas, medicos, equipos y franjas horarias).
// Son controladores muy cortos porque solo piden datos al
// service y los devuelven: no hay reglas de negocio.
//
// COMO SE USA EN EL PROYECTO:
// El frontend, al abrir el formulario de turno nuevo, llama a
// /api/catalogo/practicas. Cuando el usuario elige una practica,
// llama a /api/catalogo/medicos?id_practica=3 y a
// /api/catalogo/equipos?id_practica=3 para mostrar solo las
// opciones validas.
// ============================================================

const catalogoService = require('../services/catalogoService');

// OBJETIVO: devolver los servicios del centro.
async function obtenerServicios(req, res, next) {
    try {
        res.json(await catalogoService.listarServicios());
    } catch (error) {
        next(error);
    }
}

// OBJETIVO: devolver todas las practicas con su duracion.
async function obtenerPracticas(req, res, next) {
    try {
        res.json(await catalogoService.listarPracticas());
    } catch (error) {
        next(error);
    }
}

// OBJETIVO: devolver los medicos, filtrados por practica si
// viene el parametro id_practica en la direccion
// (?id_practica=3 llega en req.query.id_practica).
async function obtenerMedicos(req, res, next) {
    try {
        res.json(await catalogoService.listarMedicos(req.query.id_practica));
    } catch (error) {
        next(error);
    }
}

// OBJETIVO: devolver los equipos compatibles con una practica.
async function obtenerEquipos(req, res, next) {
    try {
        res.json(await catalogoService.listarEquipos(req.query.id_practica));
    } catch (error) {
        next(error);
    }
}

// OBJETIVO: devolver las franjas horarias de un medico.
// La matricula es obligatoria: sin ella no hay nada que buscar.
async function obtenerDisponibilidades(req, res, next) {
    try {
        const matricula = req.query.matricula_medico;

        if (!matricula) {
            return res.status(400).json({
                error: 'Hay que indicar la matricula del medico'
            });
        }

        res.json(await catalogoService.listarDisponibilidades(matricula));
    } catch (error) {
        next(error);
    }
}

module.exports = {
    obtenerServicios,
    obtenerPracticas,
    obtenerMedicos,
    obtenerEquipos,
    obtenerDisponibilidades
};
