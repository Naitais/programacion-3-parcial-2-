// ============================================================
// MODULO: scripts/crearUsuarios.js
// ============================================================
// PARA QUE EXISTE:
// En la base de datos original solo existe el usuario
// administrador. Para poder demostrar los tres perfiles que
// pide el parcial hacen falta tambien un medico y un paciente.
// Este script los crea (o les resetea la contrasenia).
//
// NO es parte del servidor: es una herramienta que se ejecuta
// UNA VEZ, a mano, desde la terminal:
//
//     cd backend
//     node scripts/crearUsuarios.js
//
// POR QUE UN SCRIPT Y NO UN INSERT EN SQL:
// Porque la contrasenia se guarda hasheada con bcrypt, y el
// hash lo tiene que calcular JavaScript. En SQL tendriamos que
// pegar un hash hecho a mano y no sabriamos a que contrasenia
// corresponde.
// ============================================================

require('dotenv').config();

const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Los usuarios de prueba, uno por rol.
// id_rol: 1 = ADMIN, 2 = MEDICO, 3 = PACIENTE (tabla rol).
//
// El medico se vincula con una matricula que ya existe en la
// tabla medico, y el paciente con un DNI que ya existe en la
// tabla paciente. Esa vinculacion es la que despues permite
// que cada uno vea solamente sus turnos.
const USUARIOS = [
    {
        email: 'admin@turnos.com',
        password: 'AdminTurnos2026!',
        id_rol: 1,
        dni_paciente: null,
        matricula_medico: null,
        descripcion: 'Administrador del centro'
    },
    {
        email: 'medico@turnos.com',
        password: 'MedicoTurnos2026!',
        id_rol: 2,
        dni_paciente: null,
        matricula_medico: 1001,            // Perez, Marcelo
        descripcion: 'Medico (matricula 1001)'
    },
    {
        email: 'paciente@turnos.com',
        password: 'PacienteTurnos2026!',
        id_rol: 3,
        dni_paciente: 30100101,            // Juan Perez
        matricula_medico: null,
        descripcion: 'Paciente (DNI 30100101)'
    }
];

// OBJETIVO DE LA FUNCION:
// Recorrer la lista de usuarios y, para cada uno, crearlo si no
// existe o actualizarle la contrasenia si ya existia.
async function crearUsuarios() {
    try {
        console.log('Creando usuarios de prueba...\n');

        // for...of permite usar await adentro del bucle: cada
        // usuario se procesa cuando termina el anterior.
        for (const usuario of USUARIOS) {

            // bcrypt.hash calcula el hash de la contrasenia.
            // El 10 es el "costo": cuantas vueltas da el
            // algoritmo. Mas alto = mas seguro y mas lento.
            const hash = await bcrypt.hash(usuario.password, 10);

            // Miramos si el email ya tiene cuenta.
            const [existentes] = await db.execute(
                'SELECT id_usuario FROM usuario WHERE email = ?',
                [usuario.email]
            );

            if (existentes.length > 0) {
                // Ya existia: le ponemos la contrasenia conocida
                // y nos aseguramos de que este activo.
                await db.execute(
                    `UPDATE usuario
                     SET password_hash = ?, id_rol = ?, activo = 1
                     WHERE email = ?`,
                    [hash, usuario.id_rol, usuario.email]
                );
                console.log(`Actualizado: ${usuario.email}`);

            } else {
                // No existia: lo creamos.
                await db.execute(
                    `INSERT INTO usuario
                        (email, password_hash, id_rol, activo,
                         dni_paciente, matricula_medico)
                     VALUES (?, ?, ?, 1, ?, ?)`,
                    [
                        usuario.email,
                        hash,
                        usuario.id_rol,
                        usuario.dni_paciente,
                        usuario.matricula_medico
                    ]
                );
                console.log(`Creado:      ${usuario.email}`);
            }
        }

        console.log('\n=========================================');
        console.log('   USUARIOS PARA LA DEMOSTRACION');
        console.log('=========================================');
        USUARIOS.forEach(function (u) {
            console.log(`\n${u.descripcion}`);
            console.log(`  Email:      ${u.email}`);
            console.log(`  Contrasenia: ${u.password}`);
        });
        console.log('\n=========================================');

    } catch (error) {
        console.error('Error al crear los usuarios:', error.message);

    } finally {
        // Cerramos el pool para que el programa termine.
        // Si no lo cerramos, Node se queda esperando con las
        // conexiones abiertas.
        await db.end();
    }
}

crearUsuarios();
