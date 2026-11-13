// ============================================================
// MODULO: scripts/test-db.js
// ============================================================
// PARA QUE EXISTE:
// Para probar la conexion a MySQL sin levantar todo el
// servidor. Si algo esta mal configurado en el .env (puerto,
// usuario, contrasenia, nombre de la base), aca se ve al toque
// y no perdemos tiempo buscando el error en otro lado.
//
// COMO SE USA:
//     cd backend
//     node scripts/test-db.js
//
// ============================================================

require('dotenv').config();
const db = require('../config/database');

// OBJETIVO DE LA FUNCION:
// Hacer tres pruebas cortas: conectar, contar turnos y mostrar
// los usuarios con su rol.
async function probarConexion() {
    try {
        // Prueba 1: la consulta mas simple posible.
        const [prueba] = await db.query('SELECT 1 AS conectado');
        console.log('1) Conexion a MySQL: OK', prueba);

        // Prueba 2: contamos los turnos para ver que estamos en
        // la base correcta y tiene datos.
        const [conteo] = await db.query(
            'SELECT COUNT(*) AS cantidad FROM turno'
        );
        console.log(`2) Turnos en la base: ${conteo[0].cantidad}`);

        // Prueba 3: los usuarios que pueden iniciar sesion.
        const [usuarios] = await db.query(
            `SELECT u.id_usuario, u.email, r.nombre_rol, u.activo
             FROM usuario u
             JOIN rol r ON r.id_rol = u.id_rol
             ORDER BY u.id_usuario`
        );
        console.log('3) Usuarios registrados:');
        console.table(usuarios);

    } catch (error) {
        console.error('ERROR de conexion:', error.message);
        console.error('\nRevisa el archivo backend/.env:');
        console.error('  DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT');

    } finally {
        await db.end();
    }
}

probarConexion();
