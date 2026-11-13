// ============================================================
// MODULO: controllers/authController.js
// ============================================================
// PARA QUE EXISTE:
// Maneja el inicio de sesion y la identificacion del usuario.
// Son las dos rutas publicas/semipublicas del sistema:
//   POST /api/auth/login   -> entrega el token
//   GET  /api/auth/perfil  -> dice quien inicio sesion
//
// COMO SE USA EN EL PROYECTO:
// El frontend manda email y password al login, guarda el token
// que recibe y despues lo manda en cada pedido.
//
// QUE ES UN TOKEN JWT (JSON Web Token):
// Es un texto con tres partes separadas por puntos:
//     encabezado.datos.firma
// Las dos primeras partes son JSON codificado en base64 (se
// pueden leer, NO estan encriptadas). La tercera es la firma
// que hace el servidor con la clave secreta JWT_SECRET.
// Si alguien edita los datos (por ejemplo se pone id_rol = 1
// para hacerse admin), la firma deja de coincidir y el
// servidor lo rechaza.
// Por eso NUNCA se guardan datos secretos adentro del token.
// ============================================================

const jwt = require('jsonwebtoken');
const authService = require('../services/authService');

// ============================================================
// LOGIN
// ============================================================
// OBJETIVO DE LA FUNCION:
// Verificar email y contrasenia y, si estan bien, devolver un
// token firmado mas los datos del usuario.
async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        // 1) Datos obligatorios.
        if (!email || !password) {
            return res.status(400).json({
                error: 'El email y la contrasenia son obligatorios'
            });
        }

        // 2) Verificamos las credenciales.
        //    Normalizamos el email (sin espacios y en minusculas)
        //    para que "Admin@Turnos.com " entre igual.
        const usuario = await authService.verificarCredenciales(
            email.trim().toLowerCase(),
            password
        );

        // 3) Mensaje generico a proposito: no decimos si lo que
        //    estaba mal era el email o la contrasenia.
        //    401 = no autenticado.
        if (!usuario) {
            return res.status(401).json({
                error: 'Email o contrasenia incorrectos'
            });
        }

        // 4) Si falta la clave secreta no podemos firmar nada.
        if (!process.env.JWT_SECRET) {
            throw new Error('Falta configurar JWT_SECRET en el archivo .env');
        }

        // 5) Creamos el token.
        //    Adentro va lo minimo necesario para los permisos:
        //    quien es, que rol tiene y con que paciente o medico
        //    esta relacionado.
        //    expiresIn: '2h' hace que la sesion venza sola.
        const token = jwt.sign(
            {
                id_usuario: usuario.id_usuario,
                email: usuario.email,
                id_rol: usuario.id_rol,
                nombre_rol: usuario.nombre_rol,
                dni_paciente: usuario.dni_paciente,
                matricula_medico: usuario.matricula_medico
            },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        // 6) Devolvemos el token y los datos para mostrar.
        res.json({
            mensaje: 'Inicio de sesion exitoso',
            token: token,
            usuario: usuario
        });

    } catch (error) {
        next(error);
    }
}

// ============================================================
// PERFIL
// ============================================================
// OBJETIVO DE LA FUNCION:
// Decir quien es el usuario que esta usando el sistema.
// Cumple el pedido del parcial de "identificar al usuario que
// inicio sesion".
//
// No consulta la base de datos: los datos ya venian firmados
// dentro del token y el middleware verificarToken los dejo en
// req.usuario.
function perfil(req, res) {
    res.json({
        usuario: {
            id_usuario: req.usuario.id_usuario,
            email: req.usuario.email,
            id_rol: req.usuario.id_rol,
            nombre_rol: req.usuario.nombre_rol,
            dni_paciente: req.usuario.dni_paciente,
            matricula_medico: req.usuario.matricula_medico
        }
    });
}

module.exports = {
    login,
    perfil
};
