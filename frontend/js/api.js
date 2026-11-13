// ============================================================
// MODULO: frontend/js/api.js
// ============================================================
// PARA QUE EXISTE:
// Centraliza TODAS las llamadas al backend. Ninguna otra parte
// del frontend usa fetch directamente: si una pantalla necesita
// datos, llama a una funcion de este archivo.
//
// VENTAJAS DE TENERLO CENTRALIZADO:
//   1) El token se agrega en un solo lugar (y no se olvida).
//   2) Si cambia la direccion del backend, se cambia una linea.
//   3) Los errores se traducen una sola vez.
//
// COMO SE USA EN EL PROYECTO:
//     const datos = await api.obtenerTurnos({ estado: 'Reservado' });
//
// QUE ES fetch:
// La funcion del navegador para hacer pedidos HTTP. Devuelve
// una PROMESA, porque el pedido viaja por la red y tarda. Con
// await esperamos la respuesta sin congelar la pagina.
// ============================================================

// Direccion base de la API. El backend corre en el puerto 3000
// y el frontend puede estar en el 5500 (Live Server): por eso
// necesitamos CORS habilitado en el backend.
const API_URL = 'http://localhost:3000/api';

// ============================================================
// FUNCION: pedir   (la mas importante del archivo)
// ============================================================
// OBJETIVO DE LA FUNCION:
// Hacer un pedido HTTP al backend agregando siempre el token y
// el Content-Type, y devolver los datos ya convertidos de JSON
// a objeto JavaScript. Si el backend contesta un error, lanza
// una excepcion con el mensaje que mando el backend.
//
// PARAMETROS:
//   ruta   -> '/turnos' (se le pega adelante API_URL)
//   metodo -> 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'
//   cuerpo -> objeto a enviar (opcional)
async function pedir(ruta, metodo = 'GET', cuerpo = null) {

    // 1) Armamos las cabeceras del pedido.
    const cabeceras = {
        'Content-Type': 'application/json'
    };

    // 2) Si hay sesion, mandamos el token.
    //    El formato "Bearer <token>" es el estandar y es lo que
    //    espera leer el middleware authMiddleware.js.
    const token = obtenerToken();
    if (token) {
        cabeceras['Authorization'] = 'Bearer ' + token;
    }

    // 3) Opciones del fetch.
    const opciones = {
        method: metodo,
        headers: cabeceras
    };

    // 4) El cuerpo solo se manda en POST, PUT y PATCH, y hay
    //    que convertirlo a texto JSON: por la red viaja texto.
    if (cuerpo) {
        opciones.body = JSON.stringify(cuerpo);
    }

    // 5) Hacemos el pedido y ESPERAMOS la respuesta.
    const respuesta = await fetch(API_URL + ruta, opciones);

    // 6) Leemos el cuerpo de la respuesta como JSON.
    //    Lo envolvemos en try/catch porque algunas respuestas
    //    (por ejemplo un 204) no traen cuerpo y JSON.parse falla.
    let datos = {};
    try {
        datos = await respuesta.json();
    } catch (error) {
        datos = {};
    }

    // 7) Si el token vencio o no sirve, cerramos la sesion y
    //    volvemos al login. Pasa despues de 2 horas (expiresIn).
    if (respuesta.status === 401) {
        alert('Tu sesion vencio. Volve a iniciar sesion.');
        cerrarSesion(rutaDelLogin());
        throw new Error('Sesion vencida');
    }

    // 8) respuesta.ok es true si el codigo HTTP es 2xx.
    //    Si no, lanzamos un error con el mensaje del backend
    //    para que la pantalla lo muestre al usuario.
    if (!respuesta.ok) {
        throw new Error(datos.error || 'Ocurrio un error inesperado');
    }

    return datos;
}

// OBJETIVO DE LA FUNCION:
// Saber a que direccion volver al cerrar sesion. Desde las
// paginas que estan en /pages hay que subir un nivel.
function rutaDelLogin() {
    return window.location.pathname.includes('/pages/')
        ? '../index.html'
        : 'index.html';
}

// ============================================================
// AUTENTICACION
// ============================================================

// OBJETIVO: mandar email y contrasenia y recibir el token.
// Es la unica llamada que se hace SIN token.
async function iniciarSesion(email, password) {
    return pedir('/auth/login', 'POST', {
        email: email,
        password: password
    });
}

// OBJETIVO: preguntarle al backend quien soy.
// Sirve para comprobar que la sesion sigue valida al entrar al
// panel: si el token vencio, esta llamada devuelve 401.
async function obtenerPerfil() {
    return pedir('/auth/perfil');
}

// ============================================================
// TURNOS
// ============================================================

// OBJETIVO: traer los turnos aplicando filtros.
// Los filtros viajan en la direccion como "query string":
//     /turnos?estado=Reservado&fecha_desde=2026-11-01
// URLSearchParams arma ese texto solo y escapa los caracteres
// raros (espacios, acentos) para que la direccion sea valida.
async function obtenerTurnos(filtros = {}) {
    const parametros = new URLSearchParams();

    // Agregamos solo los filtros que tienen valor.
    for (const clave in filtros) {
        if (filtros[clave]) {
            parametros.append(clave, filtros[clave]);
        }
    }

    const consulta = parametros.toString();
    return pedir('/turnos' + (consulta ? '?' + consulta : ''));
}

// OBJETIVO: traer un turno puntual.
async function obtenerTurno(idTurno) {
    return pedir('/turnos/' + idTurno);
}

// OBJETIVO: crear un turno nuevo.
async function crearTurno(datos) {
    return pedir('/turnos', 'POST', datos);
}

// OBJETIVO: cambiar fecha, hora y franja de un turno.
async function reprogramarTurno(idTurno, datos) {
    return pedir('/turnos/' + idTurno + '/reprogramar', 'PUT', datos);
}

// OBJETIVO: pasar el turno a Confirmado.
async function confirmarTurno(idTurno) {
    return pedir('/turnos/' + idTurno + '/confirmar', 'PATCH');
}

// OBJETIVO: pasar el turno a Cancelado.
async function cancelarTurno(idTurno) {
    return pedir('/turnos/' + idTurno + '/cancelar', 'PATCH');
}

// OBJETIVO: borrar el turno (solo administrador).
async function eliminarTurno(idTurno) {
    return pedir('/turnos/' + idTurno, 'DELETE');
}

// ============================================================
// CATALOGOS (listas para los desplegables)
// ============================================================

async function obtenerPracticas() {
    return pedir('/catalogo/practicas');
}

// Trae solo los medicos que pueden hacer esa practica.
async function obtenerMedicos(idPractica) {
    return pedir('/catalogo/medicos?id_practica=' + idPractica);
}

// Trae solo los equipos compatibles con esa practica.
async function obtenerEquipos(idPractica) {
    return pedir('/catalogo/equipos?id_practica=' + idPractica);
}

// Trae las franjas horarias en las que atiende el medico.
async function obtenerDisponibilidades(matriculaMedico) {
    return pedir('/catalogo/disponibilidades?matricula_medico=' + matriculaMedico);
}

// ============================================================
// PACIENTES
// ============================================================

async function obtenerPacientes(texto) {
    return pedir('/pacientes' + (texto ? '?texto=' + encodeURIComponent(texto) : ''));
}

async function obtenerPaciente(dni) {
    return pedir('/pacientes/' + dni);
}

async function actualizarPaciente(dni, datos) {
    return pedir('/pacientes/' + dni, 'PUT', datos);
}

// Juntamos todas las funciones en un objeto llamado "api" para
// que desde las pantallas se lea claro: api.obtenerTurnos(...)
const api = {
    iniciarSesion,
    obtenerPerfil,
    obtenerTurnos,
    obtenerTurno,
    crearTurno,
    reprogramarTurno,
    confirmarTurno,
    cancelarTurno,
    eliminarTurno,
    obtenerPracticas,
    obtenerMedicos,
    obtenerEquipos,
    obtenerDisponibilidades,
    obtenerPacientes,
    obtenerPaciente,
    actualizarPaciente
};
