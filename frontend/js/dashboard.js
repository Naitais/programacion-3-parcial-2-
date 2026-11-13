// ============================================================
// MODULO: frontend/js/dashboard.js
// ============================================================
// PARA QUE EXISTE:
// Es el cerebro del panel. Hace cuatro cosas:
//   1) protege la pagina (si no hay sesion, al login),
//   2) adapta el menu y los botones al rol del usuario,
//   3) pide los datos al backend con api.js,
//   4) dibuja los datos en el HTML y escucha los clics.
//
// COMO SE USA EN EL PROYECTO:
// Lo carga pages/dashboard.html al final del body.
//
// ESTRUCTURA DEL ARCHIVO (por si hay que buscar algo):
//   PARTE 1 - Proteccion de la sesion
//   PARTE 2 - Mostrar quien inicio sesion
//   PARTE 3 - Menu y secciones
//   PARTE 4 - Turnos: listar y filtrar
//   PARTE 5 - Acciones sobre un turno
//   PARTE 6 - Nuevo turno (desplegables encadenados)
//   PARTE 7 - Pacientes
//   PARTE 8 - Mis datos
//   PARTE 9 - Arranque
// ============================================================

// ============================================================
// PARTE 1 - PROTECCION DE LA SESION
// ============================================================
// Lo primero de todo: si no hay token, esta pagina no se ve.
// exigirSesion esta en sesion.js y redirige al login.
// El "return" de abajo no se puede usar fuera de una funcion,
// asi que usamos un if que envuelve el resto del arranque.
const haySesion = exigirSesion('../index.html');

// Datos del usuario que inicio sesion (nombre, rol, dni...).
const usuario = obtenerUsuario();

// Aca guardamos los turnos que trajimos del backend, para no
// tener que volver a pedirlos cuando el usuario aprieta un
// boton de accion.
let turnosCargados = [];

// ------------------------------------------------------------
// Elementos del HTML que vamos a usar varias veces.
// ------------------------------------------------------------
const aviso = document.getElementById('aviso');
const tituloSeccion = document.getElementById('tituloSeccion');
const cuerpoTablaTurnos = document.getElementById('cuerpoTablaTurnos');
const contadorTurnos = document.getElementById('contadorTurnos');

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

// OBJETIVO: mostrar un cartel de aviso arriba del panel.
// tipo = 'ok' (verde) o 'error' (rojo).
function mostrarAviso(texto, tipo) {
    aviso.textContent = texto;
    aviso.className = tipo === 'error' ? 'mensaje-error' : 'mensaje-ok';

    // Lo borramos despues de 6 segundos.
    // setTimeout es asincronico: programa la funcion para
    // despues y sigue de largo (no frena nada).
    setTimeout(function () {
        aviso.textContent = '';
        aviso.className = '';
    }, 6000);
}

// OBJETIVO: pasar "2026-11-20" a "20/11/2026" para mostrar.
function formatearFecha(fecha) {
    if (!fecha) return '';
    const partes = String(fecha).slice(0, 10).split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// OBJETIVO: dejar la hora en "09:30" (sin los segundos).
function formatearHora(hora) {
    return hora ? String(hora).slice(0, 5) : '';
}

// OBJETIVO: devolver la fecha de hoy en formato AAAA-MM-DD,
// que es el que entienden los <input type="date">.
function hoyParaInput() {
    const ahora = new Date();
    return (
        ahora.getFullYear() + '-' +
        String(ahora.getMonth() + 1).padStart(2, '0') + '-' +
        String(ahora.getDate()).padStart(2, '0')
    );
}

// OBJETIVO: llenar un <select> con opciones.
// lista   -> array de objetos traidos del backend
// valor   -> nombre de la propiedad que va en el value
// texto   -> funcion que arma lo que ve el usuario
function llenarSelect(select, lista, valor, texto, textoVacio) {
    select.innerHTML = `<option value="">${textoVacio}</option>`;

    lista.forEach(function (item) {
        const opcion = document.createElement('option');
        opcion.value = item[valor];
        opcion.textContent = texto(item);
        select.appendChild(opcion);
    });
}

// ============================================================
// PARTE 2 - MOSTRAR QUIEN INICIO SESION
// ============================================================
// OBJETIVO DE LA FUNCION:
// Escribir en pantalla el nombre y el rol del usuario, y la
// lista de lo que puede hacer. Esto responde al pedido de la
// consigna "identificar al usuario que inicio sesion".
function mostrarDatosDelUsuario() {

    document.getElementById('datosUsuario').textContent =
        `${usuario.nombre_completo}  |  Perfil: ${usuario.nombre_rol}  |  ${usuario.email}`;

    // Detalle de la sesion.
    const listaSesion = document.getElementById('listaSesion');
    listaSesion.innerHTML = `
        <li><strong>Usuario:</strong> ${usuario.email}</li>
        <li><strong>Perfil:</strong> ${usuario.nombre_rol}</li>
        <li><strong>DNI vinculado:</strong> ${usuario.dni_paciente || '-'}</li>
        <li><strong>Matricula vinculada:</strong> ${usuario.matricula_medico || '-'}</li>
    `;

    // Permisos segun el rol. Es util tenerlo escrito en
    // pantalla para la demostracion.
    const permisos = {
        ADMIN: [
            'Ver TODOS los turnos del centro',
            'Crear, reprogramar, confirmar, cancelar y eliminar turnos',
            'Ver y actualizar los datos de cualquier paciente'
        ],
        MEDICO: [
            'Ver solamente los turnos de su propia agenda',
            'Confirmar y cancelar sus turnos',
            'Consultar los datos de contacto de los pacientes',
            'NO puede crear turnos ni eliminarlos'
        ],
        PACIENTE: [
            'Ver solamente sus propios turnos',
            'Sacar un turno nuevo para si mismo',
            'Reprogramar y cancelar sus turnos',
            'Actualizar sus datos de contacto',
            'NO puede ver turnos de otros pacientes'
        ]
    };

    const listaPermisos = document.getElementById('listaPermisos');
    listaPermisos.innerHTML = permisos[usuario.nombre_rol]
        .map(function (texto) { return `<li>${texto}</li>`; })
        .join('');
}

// ============================================================
// PARTE 3 - MENU Y SECCIONES
// ============================================================

// OBJETIVO DE LA FUNCION:
// Esconder las opciones del menu que no corresponden al rol.
// Lee el atributo data-roles del HTML:
//     <a data-seccion="nuevo" data-roles="ADMIN,PACIENTE">
// Si el rol del usuario no esta en esa lista, la opcion se
// esconde. Asi "adaptamos el frontend al perfil".
function adaptarMenuAlRol() {

    document.querySelectorAll('#menu a').forEach(function (enlace) {

        // "ADMIN,PACIENTE" -> ['ADMIN', 'PACIENTE']
        const rolesPermitidos = enlace.dataset.roles.split(',');

        if (!rolesPermitidos.includes(usuario.nombre_rol)) {
            enlace.classList.add('oculto');
        }
    });
}

// OBJETIVO DE LA FUNCION:
// Mostrar una seccion y esconder las demas.
function mostrarSeccion(nombre) {

    // Escondemos todas.
    document.querySelectorAll('.seccion').forEach(function (seccion) {
        seccion.classList.add('oculto');
    });

    // Mostramos la pedida. Los id del HTML son "seccionInicio",
    // "seccionTurnos", etc.
    const titulos = {
        inicio: 'Panel principal',
        turnos: 'Turnos',
        nuevo: 'Nuevo turno',
        pacientes: 'Pacientes',
        misdatos: 'Mis datos'
    };

    const ids = {
        inicio: 'seccionInicio',
        turnos: 'seccionTurnos',
        nuevo: 'seccionNuevo',
        pacientes: 'seccionPacientes',
        misdatos: 'seccionMisDatos'
    };

    document.getElementById(ids[nombre]).classList.remove('oculto');
    tituloSeccion.textContent = titulos[nombre];

    // Marcamos la opcion activa del menu.
    document.querySelectorAll('#menu a').forEach(function (enlace) {
        enlace.classList.toggle('activo', enlace.dataset.seccion === nombre);
    });
}

// OBJETIVO DE LA FUNCION:
// Escuchar los clics del menu y cargar los datos de cada
// seccion la primera vez que se entra.
function activarMenu() {

    document.querySelectorAll('#menu a').forEach(function (enlace) {

        enlace.addEventListener('click', function (evento) {
            evento.preventDefault();

            const seccion = enlace.dataset.seccion;
            mostrarSeccion(seccion);

            // Cada seccion pide sus datos al entrar.
            if (seccion === 'turnos') cargarTurnos();
            if (seccion === 'nuevo') prepararFormularioNuevoTurno();
            if (seccion === 'pacientes') cargarPacientes();
            if (seccion === 'misdatos') cargarMisDatos();
        });
    });

    // Boton de cerrar sesion: borra el token y vuelve al login.
    document.getElementById('cerrarSesion')
        .addEventListener('click', function () {
            cerrarSesion('../index.html');
        });
}

// ============================================================
// PARTE 4 - TURNOS: LISTAR Y FILTRAR
// ============================================================

// OBJETIVO DE LA FUNCION:
// Pedir los turnos al backend con los filtros elegidos y
// dibujar la tabla.
//
// Es async porque espera la respuesta de la API.
async function cargarTurnos() {
    try {
        cuerpoTablaTurnos.innerHTML =
            '<tr><td colspan="9">Cargando turnos...</td></tr>';

        // Armamos el objeto de filtros con lo que haya puesto el
        // usuario. Los que queden vacios, api.js los descarta.
        const filtros = {
            fecha_desde: document.getElementById('filtroDesde').value,
            fecha_hasta: document.getElementById('filtroHasta').value,
            estado: document.getElementById('filtroEstado').value
        };

        const respuesta = await api.obtenerTurnos(filtros);

        // Guardamos la lista para usarla en las acciones.
        turnosCargados = respuesta.turnos;

        dibujarTablaTurnos(respuesta.turnos);

        contadorTurnos.textContent =
            `${respuesta.total} turno(s) encontrado(s)`;

    } catch (error) {
        cuerpoTablaTurnos.innerHTML =
            `<tr><td colspan="9">No se pudieron cargar los turnos</td></tr>`;
        mostrarAviso(error.message, 'error');
    }
}

// OBJETIVO DE LA FUNCION:
// Construir las filas de la tabla a partir del array de turnos.
// Por cada turno arma un <tr> con sus datos y los botones que
// le corresponden al rol.
function dibujarTablaTurnos(turnos) {

    if (turnos.length === 0) {
        cuerpoTablaTurnos.innerHTML =
            '<tr><td colspan="9">No hay turnos para mostrar</td></tr>';
        return;
    }

    // map transforma cada turno en un texto HTML, y join los
    // pega todos juntos. Es mas rapido que ir agregando fila por
    // fila al documento.
    cuerpoTablaTurnos.innerHTML = turnos.map(function (turno) {

        // La clase del estado le da el color a la etiqueta.
        const claseEstado = 'estado-' + turno.estado_turno.toLowerCase();

        return `
            <tr>
                <td>${turno.id_turno}</td>
                <td>${formatearFecha(turno.fecha_turno)}</td>
                <td>${formatearHora(turno.hora_turno)}</td>
                <td>${turno.paciente}</td>
                <td>${turno.medico || '-'}</td>
                <td>${turno.nombre_practica}<br><small>${turno.duracion} min</small></td>
                <td>${turno.nombre_equipo || '-'}</td>
                <td><span class="etiqueta ${claseEstado}">${turno.estado_turno}</span></td>
                <td class="acciones">${botonesDelTurno(turno)}</td>
            </tr>
        `;
    }).join('');
}

// OBJETIVO DE LA FUNCION:
// Decidir que botones se muestran para cada turno, segun el rol
// del usuario y el estado del turno.
//
// Los botones guardan el id del turno en data-id y la accion en
// data-accion. Despues un solo escuchador se encarga de todos
// (ver activarAccionesDeTurnos).
function botonesDelTurno(turno) {

    const rol = usuario.nombre_rol;
    const estado = turno.estado_turno;
    const botones = [];

    // Un turno cancelado no se toca mas: ninguna accion.
    if (estado === 'Cancelado') {
        // El admin igual puede borrarlo de la base.
        if (rol === 'ADMIN') {
            botones.push(
                `<button class="chico peligro" data-accion="eliminar"
                         data-id="${turno.id_turno}">Eliminar</button>`
            );
        }
        return botones.join(' ') || '<small>Sin acciones</small>';
    }

    // CONFIRMAR: el centro confirma (admin o medico) y solo si
    // todavia esta reservado.
    if ((rol === 'ADMIN' || rol === 'MEDICO') && estado === 'Reservado') {
        botones.push(
            `<button class="chico" data-accion="confirmar"
                     data-id="${turno.id_turno}">Confirmar</button>`
        );
    }

    // REPROGRAMAR: el admin o el propio paciente.
    if (rol === 'ADMIN' || rol === 'PACIENTE') {
        botones.push(
            `<button class="chico secundario" data-accion="reprogramar"
                     data-id="${turno.id_turno}">Reprogramar</button>`
        );
    }

    // CANCELAR: los tres roles.
    botones.push(
        `<button class="chico peligro" data-accion="cancelar"
                 data-id="${turno.id_turno}">Cancelar</button>`
    );

    // ELIMINAR: solo el admin.
    if (rol === 'ADMIN') {
        botones.push(
            `<button class="chico peligro" data-accion="eliminar"
                     data-id="${turno.id_turno}">Eliminar</button>`
        );
    }

    return botones.join(' ');
}

// OBJETIVO DE LA FUNCION:
// Activar los filtros de busqueda.
function activarFiltros() {

    document.getElementById('formFiltros')
        .addEventListener('submit', function (evento) {
            evento.preventDefault();
            cargarTurnos();
        });

    document.getElementById('botonLimpiar')
        .addEventListener('click', function () {
            document.getElementById('filtroDesde').value = '';
            document.getElementById('filtroHasta').value = '';
            document.getElementById('filtroEstado').value = '';
            cargarTurnos();
        });
}

// ============================================================
// PARTE 5 - ACCIONES SOBRE UN TURNO
// ============================================================

// OBJETIVO DE LA FUNCION:
// Escuchar los clics de TODOS los botones de la tabla con un
// solo escuchador.
//
// POR QUE ASI (delegacion de eventos):
// Las filas se crean y se destruyen cada vez que recargamos la
// tabla. Si le pusieramos un escuchador a cada boton, habria
// que volver a ponerlos despues de cada recarga. En cambio el
// <tbody> no se destruye nunca: le ponemos el escuchador a el y
// preguntamos en que boton se hizo clic (evento.target).
function activarAccionesDeTurnos() {

    cuerpoTablaTurnos.addEventListener('click', async function (evento) {

        // El clic puede ser en cualquier parte de la tabla.
        // Solo nos interesan los botones con data-accion.
        const boton = evento.target.closest('button[data-accion]');
        if (!boton) {
            return;
        }

        const idTurno = boton.dataset.id;
        const accion = boton.dataset.accion;

        try {
            if (accion === 'confirmar') {
                const respuesta = await api.confirmarTurno(idTurno);
                mostrarAviso(respuesta.mensaje, 'ok');
                cargarTurnos();
            }

            if (accion === 'cancelar') {
                // confirm() muestra el cartel de "Aceptar/Cancelar"
                // del navegador y devuelve true o false.
                if (confirm(`Seguro que querés cancelar el turno ${idTurno}?`)) {
                    const respuesta = await api.cancelarTurno(idTurno);
                    mostrarAviso(respuesta.mensaje, 'ok');
                    cargarTurnos();
                }
            }

            if (accion === 'eliminar') {
                if (confirm(`Eliminar definitivamente el turno ${idTurno}?`)) {
                    const respuesta = await api.eliminarTurno(idTurno);
                    mostrarAviso(respuesta.mensaje, 'ok');
                    cargarTurnos();
                }
            }

            if (accion === 'reprogramar') {
                abrirPanelReprogramar(idTurno);
            }

        } catch (error) {
            // Aca caen los errores de validacion del backend:
            // "El medico ya tiene un turno a las 09:00 ese dia",
            // "El turno esta cancelado y no se puede confirmar"...
            mostrarAviso(error.message, 'error');
        }
    });
}

// OBJETIVO DE LA FUNCION:
// Abrir el panel de reprogramacion con los datos del turno
// cargados y las franjas horarias de SU medico.
async function abrirPanelReprogramar(idTurno) {

    // Buscamos el turno en la lista que ya tenemos cargada.
    // find devuelve el primer elemento que cumple la condicion.
    const turno = turnosCargados.find(function (t) {
        return String(t.id_turno) === String(idTurno);
    });

    if (!turno) {
        return;
    }

    document.getElementById('reprogramarId').value = turno.id_turno;
    document.getElementById('reprogramarIdTexto').textContent =
        `#${turno.id_turno} - ${turno.paciente} - ${turno.nombre_practica}`;

    // Dejamos cargada la fecha y hora actuales del turno.
    document.getElementById('reprogramarFecha').value = turno.fecha_turno;
    document.getElementById('reprogramarFecha').min = hoyParaInput();
    document.getElementById('reprogramarHora').value =
        formatearHora(turno.hora_turno);

    // Traemos las franjas horarias del medico del turno.
    try {
        const franjas = await api.obtenerDisponibilidades(turno.matricula_medico);

        llenarSelect(
            document.getElementById('reprogramarDisponibilidad'),
            franjas,
            'id_disponibilidad',
            function (f) {
                return `${f.dia} de ${formatearHora(f.hora_desde)} a ${formatearHora(f.hora_hasta)}`;
            },
            'Elegi la franja'
        );

        // Dejamos seleccionada la que ya tenia.
        document.getElementById('reprogramarDisponibilidad').value =
            turno.id_disponibilidad || '';

    } catch (error) {
        mostrarAviso(error.message, 'error');
    }

    document.getElementById('panelReprogramar').classList.remove('oculto');
}

// OBJETIVO DE LA FUNCION:
// Activar el formulario de reprogramacion.
function activarReprogramacion() {

    document.getElementById('formReprogramar')
        .addEventListener('submit', async function (evento) {
            evento.preventDefault();

            const idTurno = document.getElementById('reprogramarId').value;

            const datos = {
                fecha_turno: document.getElementById('reprogramarFecha').value,
                hora_turno: document.getElementById('reprogramarHora').value,
                id_disponibilidad:
                    document.getElementById('reprogramarDisponibilidad').value
            };

            try {
                const respuesta = await api.reprogramarTurno(idTurno, datos);
                mostrarAviso(respuesta.mensaje, 'ok');

                document.getElementById('panelReprogramar')
                    .classList.add('oculto');

                cargarTurnos();

            } catch (error) {
                mostrarAviso(error.message, 'error');
            }
        });

    document.getElementById('botonCancelarReprogramar')
        .addEventListener('click', function () {
            document.getElementById('panelReprogramar').classList.add('oculto');
        });
}

// ============================================================
// PARTE 6 - NUEVO TURNO (desplegables encadenados)
// ============================================================

// OBJETIVO DE LA FUNCION:
// Preparar el formulario de turno nuevo: cargar practicas y, si
// es el admin, la lista de pacientes.
async function prepararFormularioNuevoTurno() {
    try {
        // La fecha minima que se puede elegir es hoy: es la
        // misma validacion de fecha pasada, pero del lado del
        // frontend (el backend la vuelve a controlar igual).
        document.getElementById('nuevaFecha').min = hoyParaInput();

        // El paciente no elige paciente: el turno es para el.
        if (usuario.nombre_rol === 'PACIENTE') {
            document.getElementById('campoPaciente').classList.add('oculto');
        } else {
            const respuesta = await api.obtenerPacientes();
            llenarSelect(
                document.getElementById('nuevoPaciente'),
                respuesta.pacientes,
                'dni_paciente',
                function (p) {
                    return `${p.apellido_paciente}, ${p.nombre_paciente} (DNI ${p.dni_paciente})`;
                },
                'Elegi el paciente'
            );
        }

        const practicas = await api.obtenerPracticas();
        llenarSelect(
            document.getElementById('nuevaPractica'),
            practicas,
            'id_practica',
            function (p) {
                return `${p.nombre_practica} - ${p.nombre_servicio} (${p.duracion} min)`;
            },
            'Elegi una practica'
        );

    } catch (error) {
        mostrarAviso(error.message, 'error');
    }
}

// OBJETIVO DE LA FUNCION:
// Encadenar los desplegables:
//   practica elegida -> medicos habilitados + equipos compatibles
//   medico elegido   -> franjas horarias de ese medico
//
// Esto hace que el usuario solo pueda armar combinaciones que
// ya cumplen las reglas (el medico sabe hacer la practica, el
// equipo sirve para esa practica, la franja es del medico).
function activarFormularioNuevoTurno() {

    const selectPractica = document.getElementById('nuevaPractica');
    const selectMedico = document.getElementById('nuevoMedico');
    const selectEquipo = document.getElementById('nuevoEquipo');
    const selectDisponibilidad = document.getElementById('nuevaDisponibilidad');

    // El evento 'change' se dispara cuando el usuario cambia la
    // opcion elegida del desplegable.
    selectPractica.addEventListener('change', async function () {
        const idPractica = selectPractica.value;

        if (!idPractica) {
            return;
        }

        try {
            // Pedimos las dos listas al backend.
            const medicos = await api.obtenerMedicos(idPractica);
            const equipos = await api.obtenerEquipos(idPractica);

            llenarSelect(selectMedico, medicos, 'matricula_medico',
                function (m) { return `${m.medico} (Mat. ${m.matricula_medico})`; },
                'Elegi el medico');

            llenarSelect(selectEquipo, equipos, 'id_equipo',
                function (e) { return e.nombre_equipo; },
                'Sin equipo');

            // Al cambiar la practica, la franja del medico
            // anterior ya no sirve: la limpiamos.
            selectDisponibilidad.innerHTML =
                '<option value="">Primero elegi el medico</option>';

        } catch (error) {
            mostrarAviso(error.message, 'error');
        }
    });

    selectMedico.addEventListener('change', async function () {
        const matricula = selectMedico.value;

        if (!matricula) {
            return;
        }

        try {
            const franjas = await api.obtenerDisponibilidades(matricula);

            llenarSelect(selectDisponibilidad, franjas, 'id_disponibilidad',
                function (f) {
                    return `${f.dia} de ${formatearHora(f.hora_desde)} a ${formatearHora(f.hora_hasta)}`;
                },
                'Elegi la franja');

        } catch (error) {
            mostrarAviso(error.message, 'error');
        }
    });

    // ---- Envio del formulario -------------------------------
    document.getElementById('formNuevoTurno')
        .addEventListener('submit', async function (evento) {
            evento.preventDefault();

            // Armamos el objeto que espera el backend.
            const datos = {
                fecha_turno: document.getElementById('nuevaFecha').value,
                hora_turno: document.getElementById('nuevaHora').value,
                id_practica: selectPractica.value,
                matricula_medico: selectMedico.value,
                id_disponibilidad: selectDisponibilidad.value,
                id_equipo: selectEquipo.value || null,
                medio_solicitado: document.getElementById('nuevoMedio').value
            };

            // Si es el admin, el paciente sale del desplegable.
            // Si es un paciente, el backend le pone su propio DNI
            // (no confiamos en lo que manda el navegador).
            if (usuario.nombre_rol !== 'PACIENTE') {
                datos.dni_paciente = document.getElementById('nuevoPaciente').value;
            } else {
                datos.dni_paciente = usuario.dni_paciente;
            }

            try {
                const respuesta = await api.crearTurno(datos);

                mostrarAviso(
                    `${respuesta.mensaje} (turno #${respuesta.turno.id_turno})`,
                    'ok'
                );

                // Limpiamos el formulario y mostramos la lista
                // para que se vea el turno nuevo.
                document.getElementById('formNuevoTurno').reset();
                mostrarSeccion('turnos');
                cargarTurnos();

            } catch (error) {
                // Mensajes de las validaciones del backend.
                mostrarAviso(error.message, 'error');
            }
        });
}

// ============================================================
// PARTE 7 - PACIENTES
// ============================================================

// OBJETIVO DE LA FUNCION:
// Traer la lista de pacientes y dibujarla, con busqueda
// opcional por texto.
async function cargarPacientes() {
    const cuerpo = document.getElementById('cuerpoTablaPacientes');

    try {
        const texto = document.getElementById('buscarPaciente').value.trim();
        const respuesta = await api.obtenerPacientes(texto);

        if (respuesta.pacientes.length === 0) {
            cuerpo.innerHTML =
                '<tr><td colspan="5">No se encontraron pacientes</td></tr>';
            return;
        }

        cuerpo.innerHTML = respuesta.pacientes.map(function (p) {
            return `
                <tr>
                    <td>${p.dni_paciente}</td>
                    <td>${p.apellido_paciente}, ${p.nombre_paciente}</td>
                    <td>${p.tel_paciente || '-'}</td>
                    <td>${p.email_paciente || '-'}</td>
                    <td>${p.nombre_os || 'Sin obra social'}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        cuerpo.innerHTML =
            '<tr><td colspan="5">No se pudieron cargar los pacientes</td></tr>';
        mostrarAviso(error.message, 'error');
    }
}

// OBJETIVO DE LA FUNCION: activar el buscador de pacientes.
function activarBuscadorPacientes() {
    document.getElementById('formBuscarPaciente')
        .addEventListener('submit', function (evento) {
            evento.preventDefault();
            cargarPacientes();
        });
}

// ============================================================
// PARTE 8 - MIS DATOS (solo paciente)
// ============================================================

// OBJETIVO DE LA FUNCION:
// Traer la ficha del paciente que inicio sesion y llenar el
// formulario.
async function cargarMisDatos() {
    try {
        const paciente = await api.obtenerPaciente(usuario.dni_paciente);

        document.getElementById('misDatosNombre').value =
            `${paciente.apellido_paciente}, ${paciente.nombre_paciente}`;
        document.getElementById('misDatosDni').value = paciente.dni_paciente;
        document.getElementById('misDatosTelefono').value =
            paciente.tel_paciente || '';
        document.getElementById('misDatosEmail').value =
            paciente.email_paciente || '';

    } catch (error) {
        mostrarAviso(error.message, 'error');
    }
}

// OBJETIVO DE LA FUNCION:
// Guardar los cambios de telefono y email.
function activarMisDatos() {
    document.getElementById('formMisDatos')
        .addEventListener('submit', async function (evento) {
            evento.preventDefault();

            const datos = {
                tel_paciente: document.getElementById('misDatosTelefono').value.trim(),
                email_paciente: document.getElementById('misDatosEmail').value.trim()
            };

            try {
                const respuesta = await api.actualizarPaciente(
                    usuario.dni_paciente,
                    datos
                );
                mostrarAviso(respuesta.mensaje, 'ok');

            } catch (error) {
                mostrarAviso(error.message, 'error');
            }
        });
}

// ============================================================
// PARTE 9 - ARRANQUE
// ============================================================
// OBJETIVO DE LA FUNCION:
// Poner todo en marcha cuando se abre la pagina.
//
// Se llama una sola vez, al final del archivo. El orden es:
// mostrar el usuario, adaptar el menu, activar los
// escuchadores y comprobar contra el backend que la sesion
// siga siendo valida.
async function iniciarPanel() {

    if (!haySesion) {
        return;      // exigirSesion ya redirigio al login
    }

    mostrarDatosDelUsuario();
    adaptarMenuAlRol();
    activarMenu();
    activarFiltros();
    activarAccionesDeTurnos();
    activarReprogramacion();
    activarFormularioNuevoTurno();
    activarBuscadorPacientes();
    activarMisDatos();

    mostrarSeccion('inicio');

    // Le preguntamos al backend quien somos.
    // Si el token vencio, api.js detecta el 401 y nos manda al
    // login automaticamente.
    try {
        await api.obtenerPerfil();
    } catch (error) {
        // El propio api.js ya se encargo de avisar.
    }
}

iniciarPanel();
