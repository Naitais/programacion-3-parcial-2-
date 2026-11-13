// ============================================================
// MODULO: config/database.js
// ============================================================
// PARA QUE EXISTE:
// Es el unico archivo que sabe como conectarse a MySQL.
// Crea un "pool" (una bolsa de conexiones ya abiertas y listas
// para usar) y lo exporta. Todos los services piden las
// conexiones desde aca.
//
// COMO SE USA EN EL PROYECTO:
// En cualquier service escribimos:
//     const db = require('../config/database');
//     const [filas] = await db.query('SELECT ...');
//
// POR QUE UN POOL Y NO UNA CONEXION SUELTA:
// Abrir una conexion a la base tarda. El pool abre varias una
// sola vez y las va prestando. Cuando una consulta termina, la
// conexion vuelve al pool para el siguiente pedido.
// ============================================================

// mysql2/promise es la version del driver que devuelve PROMESAS.
// Gracias a eso podemos escribir "await db.query(...)" en vez de
// usar callbacks anidados.
const mysql = require('mysql2/promise');

// dotenv lee el archivo .env y carga esos valores dentro de
// process.env. Asi la contrasenia no queda escrita en el codigo.
//
// Le indicamos la ruta exacta del .env en lugar de dejar que lo
// busque solo. Por defecto dotenv lo busca en la carpeta desde
// donde se ejecuto el comando, asi que si arrancamos el
// servidor desde otra carpeta no lo encontraria y la conexion
// fallaria. __dirname es la carpeta donde esta ESTE archivo
// (backend/config), asi que subimos un nivel con '..'.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// El pool de conexiones.
const conexion = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,

    // Si las 10 conexiones estan ocupadas, el pedido espera su
    // turno en vez de fallar.
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Exportamos el pool para que lo usen los services.
module.exports = conexion;
