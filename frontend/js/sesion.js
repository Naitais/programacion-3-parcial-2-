// ============================================================
// MODULO: frontend/js/sesion.js
// ============================================================
// PARA QUE EXISTE:
// Maneja la sesion del lado del navegador: guardar el token
// cuando el usuario entra, leerlo, saber que rol tiene y
// borrarlo cuando sale.
// Esta en un archivo aparte porque lo usan TODAS las paginas
// (el login, el panel y cualquier pagina nueva que agreguemos).
//
// COMO SE USA EN EL PROYECTO:
// Se carga primero en el HTML, antes que api.js y dashboard.js:
//     <script src="js/sesion.js"></script>
//     <script src="js/api.js"></script>
//
// DONDE SE GUARDA LA SESION:
// En sessionStorage, que es una cajita de texto que tiene el
// navegador para cada pestania.
//   sessionStorage -> se borra al cerrar la pestania
//   localStorage   -> queda guardado para siempre
// Usamos sessionStorage porque es mas seguro: si alguien usa
// la computadora despues, la sesion ya no esta.
//
// IMPORTANTE PARA LA DEFENSA:
// Esto es solo comodidad para el navegador. La seguridad REAL
// esta en el backend, que valida la firma del token en cada
// pedido. Si yo edito a mano el rol guardado aca, la pantalla
// me va a mostrar botones de admin, pero el backend me va a
// devolver 403 en cuanto los use.
// ============================================================

// Nombres de las "cajitas" donde guardamos las cosas.
const CLAVE_TOKEN = 'token';
const CLAVE_USUARIO = 'usuario';

// OBJETIVO DE LA FUNCION:
// Guardar el token y los datos del usuario despues del login.
// Los datos del usuario son un objeto, y sessionStorage solo
// guarda texto: por eso usamos JSON.stringify para convertirlo.
function guardarSesion(token, usuario) {
    sessionStorage.setItem(CLAVE_TOKEN, token);
    sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
}

// OBJETIVO DE LA FUNCION:
// Devolver el token guardado, o null si no hay sesion.
function obtenerToken() {
    return sessionStorage.getItem(CLAVE_TOKEN);
}

// OBJETIVO DE LA FUNCION:
// Devolver los datos del usuario como objeto.
// JSON.parse hace lo contrario de JSON.stringify: pasa de
// texto a objeto.
function obtenerUsuario() {
    const texto = sessionStorage.getItem(CLAVE_USUARIO);
    return texto ? JSON.parse(texto) : null;
}

// OBJETIVO DE LA FUNCION:
// Decir si el usuario que inicio sesion tiene ese rol.
// Se usa para mostrar u ocultar botones:
//     if (tieneRol('ADMIN')) { ... }
function tieneRol(nombreRol) {
    const usuario = obtenerUsuario();
    return usuario !== null && usuario.nombre_rol === nombreRol;
}

// OBJETIVO DE LA FUNCION:
// Borrar la sesion y volver a la pantalla de login.
// El parametro "rutaLogin" cambia segun desde donde se llame:
// desde pages/dashboard.html hay que subir un nivel (../).
function cerrarSesion(rutaLogin) {
    sessionStorage.removeItem(CLAVE_TOKEN);
    sessionStorage.removeItem(CLAVE_USUARIO);
    window.location.href = rutaLogin || 'index.html';
}

// OBJETIVO DE LA FUNCION:
// Proteger una pagina: si no hay token, no deja ver nada y
// manda al login.
// Es la proteccion del FRONTEND (que la vista no se muestre).
// La proteccion del BACKEND (que los datos no se entreguen) la
// hace el middleware verificarToken.
function exigirSesion(rutaLogin) {
    if (!obtenerToken()) {
        window.location.href = rutaLogin || 'index.html';
        return false;
    }
    return true;
}
