// ============================================================
// MODULO: frontend/js/app.js
// ============================================================
// PARA QUE EXISTE:
// Es el JavaScript de la pantalla de login. Se encarga de
// escuchar el envio del formulario, pedirle el token al
// backend, guardarlo y entrar al panel.
//
// COMO SE USA EN EL PROYECTO:
// Lo carga index.html al final del body (asi el HTML ya existe
// cuando el script busca los elementos con getElementById).
//
// ES EL EJEMPLO MAS CLARO DE CODIGO ASINCRONICO DEL PROYECTO:
// el usuario aprieta el boton, el pedido sale por la red, la
// pagina NO se congela, y cuando llega la respuesta se ejecuta
// lo que esta despues del await.
// ============================================================

// Buscamos los elementos del HTML una sola vez y los guardamos
// en constantes, para no repetir getElementById en cada funcion.
const formulario = document.getElementById('formLogin');
const mensaje = document.getElementById('mensaje');
const boton = formulario.querySelector('button[type="submit"]');

// ------------------------------------------------------------
// SI YA HAY SESION, NO MOSTRAMOS EL LOGIN
// ------------------------------------------------------------
// Si el usuario ya entro y vuelve a index.html, lo mandamos
// directo al panel.
if (obtenerToken()) {
    window.location.href = 'pages/dashboard.html';
}

// ------------------------------------------------------------
// ENVIO DEL FORMULARIO
// ------------------------------------------------------------
// addEventListener registra un CALLBACK: una funcion que
// nosotros NO llamamos nunca. La guarda el navegador y la
// ejecuta el dia que ocurra el evento 'submit'.
//
// La funcion es "async" porque adentro usamos await.
formulario.addEventListener('submit', async function (evento) {

    // Por defecto, un formulario recarga la pagina al enviarse.
    // preventDefault lo frena para manejarlo nosotros con fetch.
    evento.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Avisamos al usuario que algo esta pasando y evitamos que
    // apriete el boton dos veces.
    mensaje.textContent = '';
    mensaje.className = '';
    boton.disabled = true;
    boton.textContent = 'Ingresando...';

    try {
        // ---- Aca esta lo asincronico -----------------------
        // El await deja esta funcion "en pausa" hasta que llega
        // la respuesta del servidor. Mientras tanto el navegador
        // sigue atendiendo al usuario (la pagina no se traba).
        const datos = await api.iniciarSesion(email, password);

        // Si llegamos a esta linea, el login salio bien.
        // Guardamos el token y los datos del usuario.
        guardarSesion(datos.token, datos.usuario);

        mensaje.textContent =
            `Bienvenida/o ${datos.usuario.nombre_completo}. ` +
            `Perfil: ${datos.usuario.nombre_rol}`;
        mensaje.className = 'mensaje-ok';

        // Entramos al panel.
        window.location.href = 'pages/dashboard.html';

    } catch (error) {
        // Si el backend contesto 401 o 400, la funcion pedir()
        // de api.js lanzo un error con el mensaje. Aca lo
        // mostramos en pantalla.
        //
        // Esto es lo que pide la consigna: "informar al usuario
        // cuando una operacion no pueda realizarse".
        mensaje.textContent = error.message;
        mensaje.className = 'mensaje-error';

    } finally {
        // El bloque finally se ejecuta SIEMPRE: con error o sin
        // error. Es el lugar ideal para volver a habilitar el
        // boton y que el formulario quede usable.
        boton.disabled = false;
        boton.textContent = 'Iniciar sesion';
    }
});

// ------------------------------------------------------------
// BOTONES DE USUARIOS DE PRUEBA
// ------------------------------------------------------------
// Completan el formulario para no tener que tipear las
// credenciales durante la presentacion.
// querySelectorAll devuelve todos los elementos que coinciden
// y forEach recorre la lista.
document.querySelectorAll('.boton-usuario').forEach(function (botonUsuario) {

    botonUsuario.addEventListener('click', function () {
        // dataset lee los atributos data-* del HTML:
        // data-email -> dataset.email
        document.getElementById('email').value = botonUsuario.dataset.email;
        document.getElementById('password').value = botonUsuario.dataset.password;
    });
});
