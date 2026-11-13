// ============================================================
// MODULO: services/authService.js
// ============================================================
// PARA QUE EXISTE:
// Es la capa que consulta la tabla usuario para el login.
// Busca al usuario por email y compara la contrasenia con el
// hash guardado. No genera el token: eso lo hace el controller.
//
// COMO SE USA EN EL PROYECTO:
//     const usuario = await authService.verificarCredenciales(email, password);
//     if (!usuario) -> credenciales incorrectas
//
// POR QUE NO GUARDAMOS LA CONTRASENIA DE FORMA LEGIBLE:
// Si alguien roba la base de datos, no tiene que poder leer las
// contrasenias. Guardamos un "hash": el resultado de pasar la
// contrasenia por una funcion de un solo sentido. Del hash no
// se puede volver a la contrasenia original.
// Para verificar, bcrypt vuelve a calcular el hash de lo que
// escribio el usuario y lo compara con el guardado.
// ============================================================

const db = require('../config/database');
const bcrypt = require('bcryptjs');

// ============================================================
// FUNCION: verificarCredenciales
// ============================================================
// OBJETIVO DE LA FUNCION:
// Decidir si el email y la contrasenia son correctos.
// Devuelve los datos del usuario (sin el hash) si estan bien,
// o null si estan mal.
//
// Los datos que devuelve son los que despues se guardan dentro
// del token: rol, dni del paciente o matricula del medico. Eso
// es lo que permite que cada usuario vea solo lo suyo.
async function verificarCredenciales(email, password) {

    // Traemos el usuario junto con el nombre de su rol y el
    // nombre de la persona.
    //
    // COALESCE devuelve el primer valor que no sea NULL:
    // si el usuario es paciente usa el nombre del paciente, si
    // es medico el del medico, y si es el admin (que no es
    // ninguno de los dos) muestra el email.
    const [usuarios] = await db.execute(
        `SELECT
            u.id_usuario,
            u.email,
            u.password_hash,
            u.id_rol,
            u.activo,
            u.dni_paciente,
            u.matricula_medico,
            rol.nombre_rol,
            COALESCE(
                CONCAT(p.nombre_paciente, ' ', p.apellido_paciente),
                CONCAT(m.nombre_medico, ' ', m.apellido_medico),
                u.email
            ) AS nombre_completo
         FROM usuario u
         JOIN rol      rol ON rol.id_rol = u.id_rol
         LEFT JOIN paciente p ON p.dni_paciente = u.dni_paciente
         LEFT JOIN medico   m ON m.matricula_medico = u.matricula_medico
         WHERE u.email = ?`,
        [email]
    );

    // No existe ningun usuario con ese email.
    //
    // Devolvemos null (el mismo resultado que si la contrasenia
    // estuviera mal) a proposito: si dijeramos "ese email no
    // existe", le estariamos regalando a un atacante la lista de
    // emails registrados.
    if (usuarios.length === 0) {
        return null;
    }

    const usuario = usuarios[0];

    // Cuenta desactivada por el administrador.
    if (usuario.activo !== 1) {
        return null;
    }

    // bcrypt.compare vuelve a hashear la contrasenia que escribio
    // el usuario y la compara con la guardada.
    // Es asincronica (devuelve una promesa) porque hashear es una
    // tarea pesada a proposito: asi se hace lento probar
    // contrasenias por fuerza bruta.
    const passwordCorrecta = await bcrypt.compare(
        password,
        usuario.password_hash
    );

    if (!passwordCorrecta) {
        return null;
    }

    // IMPORTANTE: devolvemos los datos SIN el password_hash.
    // Lo que devuelve esta funcion viaja hasta el navegador, y el
    // hash no tiene que salir nunca del servidor.
    return {
        id_usuario: usuario.id_usuario,
        email: usuario.email,
        id_rol: usuario.id_rol,
        nombre_rol: usuario.nombre_rol,
        nombre_completo: usuario.nombre_completo,
        dni_paciente: usuario.dni_paciente,
        matricula_medico: usuario.matricula_medico
    };
}

module.exports = {
    verificarCredenciales
};
