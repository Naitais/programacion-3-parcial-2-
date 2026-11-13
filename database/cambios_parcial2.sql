-- ============================================================
-- ARCHIVO: database/cambios_parcial2.sql
-- ============================================================
-- PARA QUE EXISTE:
-- Junta todos los cambios que le hicimos a la base de datos
-- para el 2do parcial. Se ejecuta UNA VEZ, despues de haber
-- importado turnos.sql.
--
-- COMO SE USA:
--   Opcion A (MySQL Workbench): abrir este archivo y ejecutar.
--   Opcion B (terminal):
--       mysql -u root -p -P 3307 gestion_turnos < cambios_parcial2.sql
--
-- IMPORTANTE: la estructura original NO se modifico. Todas las
-- tablas, claves y relaciones del trabajo practico siguen
-- iguales. Lo que hay aca son agregados.
-- ============================================================

USE gestion_turnos;

-- ------------------------------------------------------------
-- 1) ROLES DEL SISTEMA
-- ------------------------------------------------------------
-- Los tres perfiles que pide la consigna.
-- INSERT IGNORE evita el error si ya existen: si la clave
-- primaria o un UNIQUE se repite, MySQL saltea esa fila en
-- lugar de cortar el script.
INSERT IGNORE INTO rol (id_rol, nombre_rol) VALUES
    (1, 'ADMIN'),
    (2, 'MEDICO'),
    (3, 'PACIENTE');


-- ------------------------------------------------------------
-- 2) VALIDACION DEL ESTADO A NIVEL BASE DE DATOS
-- ------------------------------------------------------------
-- PROBLEMA QUE RESUELVE:
-- La columna estado_turno es VARCHAR(30) y permitia NULL, asi
-- que se podia guardar cualquier texto ("asdasd") o nada.
-- Lo detectamos en el trabajo practico.
--
-- SOLUCION EN DOS CAPAS:
--   a) El backend valida contra la lista de estados validos
--      (validators/turnoValidator.js).
--   b) La base de datos tambien lo valida, por si alguien
--      inserta directo con SQL salteando la aplicacion.
--
-- Primero nos aseguramos de que no haya nulos ni basura.
UPDATE turno
SET estado_turno = 'Reservado'
WHERE estado_turno IS NULL
   OR estado_turno NOT IN ('Reservado', 'Confirmado', 'Cancelado');

-- Ahora el estado pasa a ser obligatorio y con valor por defecto.
ALTER TABLE turno
    MODIFY estado_turno VARCHAR(30) NOT NULL DEFAULT 'Reservado';

-- Y solo admite los tres estados del enunciado.
-- (Si el CHECK ya existe, MySQL avisa con un error que se
--  puede ignorar sin problema.)
ALTER TABLE turno
    ADD CONSTRAINT chk_estado_turno
    CHECK (estado_turno IN ('Reservado', 'Confirmado', 'Cancelado'));


-- ------------------------------------------------------------
-- 3) COMPLETAR EL MEDICO DE LOS TURNOS VIEJOS
-- ------------------------------------------------------------
-- PROBLEMA QUE RESUELVE:
-- El medico de un turno se guarda en la tabla "registra".
-- En los datos originales hay 11 turnos (los que estaban
-- Reservados o Cancelados) que no tienen fila en registra, o
-- sea que no tienen medico asignado. Eso hace que en la lista
-- aparezcan con un guion en la columna Medico y que no se
-- puedan reprogramar.
--
-- SOLUCION:
-- Les asignamos un medico que cumpla las dos condiciones:
--   a) que pueda hacer esa practica   (practica_medico)
--   b) que atienda en esa franja      (medico_disponibilidad)
-- Si no hay ninguno que cumpla las dos, usamos uno que al
-- menos pueda hacer la practica (eso es el segundo SELECT del
-- COALESCE, que devuelve el primer valor no nulo).
--
-- POR QUE EL "SELECT * FROM ( ... ) AS faltantes":
-- MySQL no deja leer la misma tabla en la que se esta
-- insertando. Envolviendo la consulta en una tabla derivada,
-- MySQL la calcula primero y despues inserta.
INSERT INTO registra (matricula_medico, id_turno, id_disponibilidad)
SELECT * FROM (
    SELECT
        COALESCE(
            -- medico que hace la practica Y atiende esa franja
            (SELECT pm.matricula_medico
               FROM practica_medico pm
               JOIN medico_disponibilidad md
                    ON md.matricula_medico = pm.matricula_medico
                   AND md.id_disponibilidad = t.id_disponibilidad
              WHERE pm.id_practica = t.id_practica
              LIMIT 1),
            -- si no hay, cualquiera que haga la practica
            (SELECT pm2.matricula_medico
               FROM practica_medico pm2
              WHERE pm2.id_practica = t.id_practica
              LIMIT 1)
        ) AS matricula_medico,
        t.id_turno,
        t.id_disponibilidad
    FROM turno t
    LEFT JOIN registra r ON r.id_turno = t.id_turno
    WHERE r.id_turno IS NULL
      AND t.id_disponibilidad IS NOT NULL
) AS faltantes
WHERE faltantes.matricula_medico IS NOT NULL;


-- ------------------------------------------------------------
-- 4) INDICES PARA LAS BUSQUEDAS NUEVAS
-- ------------------------------------------------------------
-- PARA QUE SIRVEN:
-- Las validaciones de superposicion y los filtros buscan
-- siempre por fecha y por estado. Sin indice, MySQL recorre
-- toda la tabla fila por fila. Con indice va directo.
-- Con 31 turnos no se nota, pero es la forma correcta de
-- hacerlo y es facil de explicar.
CREATE INDEX idx_turno_fecha_estado
    ON turno (fecha_turno, estado_turno);

CREATE INDEX idx_turno_paciente_fecha
    ON turno (dni_paciente, fecha_turno);


-- ------------------------------------------------------------
-- 5) POR QUE NO USAMOS UN UNIQUE PARA EVITAR SUPERPOSICIONES
-- ------------------------------------------------------------
-- Alguien podria preguntar: "para que validar en el backend si
-- se podria poner un UNIQUE (medico, fecha, hora)?".
-- No alcanza, por dos razones:
--
--   a) Un UNIQUE compara valores exactos. Un turno de 09:00 que
--      dura 45 minutos se pisa con otro de 09:30, y para el
--      UNIQUE son valores distintos: lo dejaria pasar.
--
--   b) Los turnos Cancelados liberan el horario. Un UNIQUE no
--      entiende de estados: impediria reutilizar un horario que
--      quedo libre por una cancelacion.
--
-- Por eso la superposicion se valida con una consulta que tiene
-- en cuenta la duracion de la practica y el estado del turno
-- (ver backend/validators/reglasTurno.js, reglas 8, 9 y 10).


-- ------------------------------------------------------------
-- 6) VERIFICACION
-- ------------------------------------------------------------
-- Para mirar que quedo todo bien despues de ejecutar el script.
SELECT 'Roles cargados' AS control, COUNT(*) AS cantidad FROM rol
UNION ALL
SELECT 'Usuarios', COUNT(*) FROM usuario
UNION ALL
SELECT 'Turnos', COUNT(*) FROM turno
UNION ALL
SELECT 'Turnos con medico asignado', COUNT(*) FROM registra;

-- Los usuarios de los tres perfiles NO se crean aca, porque la
-- contrasenia se guarda hasheada con bcrypt y el hash lo tiene
-- que calcular JavaScript. Se crean con:
--
--     cd backend
--     node scripts/crearUsuarios.js
