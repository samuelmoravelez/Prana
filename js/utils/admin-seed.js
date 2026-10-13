/**
 * js/utils/admin-seed.js
 * Crea el usuario administrador por defecto si no existe ninguno en
 * prana_usuarios. Se ejecuta una sola vez al cargar la aplicación.
 *
 * Credenciales del admin de prueba:
 *   Email:      admin@prana.com
 *   Contraseña: Admin123*
 *   Rol:        admin
 *
 * Dependencias: utils/hash.js (debe cargarse antes de este archivo).
 *
 * SEGURIDAD: Este seed es exclusivo para desarrollo / demostración.
 * En producción el admin debe crearse desde el servidor, nunca desde el cliente.
 */
(function () {
    'use strict';

    var KEY_USUARIOS = 'prana_usuarios';

    var ADMIN_EMAIL  = 'admin@prana.com';
    var ADMIN_PASS   = 'Admin123*';
    var ADMIN_NOMBRE = 'Administrador Prana';

    /** Lee y parsea el array de usuarios de localStorage. */
    function leerUsuarios() {
        try {
            var raw = localStorage.getItem(KEY_USUARIOS);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    /** Guarda el array de usuarios en localStorage. */
    function guardarUsuarios(usuarios) {
        try { localStorage.setItem(KEY_USUARIOS, JSON.stringify(usuarios)); } catch (e) {}
    }

    /** Genera un ID de usuario simple y reproducible para el admin. */
    function generarIdAdmin() {
        return 'usr_admin_prana_default';
    }

    /**
     * Verifica si ya existe al menos un usuario con role === 'admin'.
     * También acepta el usuario cuyo email sea ADMIN_EMAIL aunque no tenga role,
     * para no duplicar si fue creado manualmente antes de este seed.
     */
    function yaExisteAdmin(usuarios) {
        return usuarios.some(function (u) {
            return u.role === 'admin' || u.email === ADMIN_EMAIL;
        });
    }

    /**
     * Punto de entrada. Async porque Hash.crearHash devuelve una Promise.
     * Se llama desde DOMContentLoaded o desde init() del dashboard.
     */
    async function sembrarAdminSiNecesario() {
        // Verificar que Hash esté disponible (depende de utils/hash.js)
        if (typeof Hash === 'undefined') {
            console.warn('[AdminSeed] Hash no disponible. El seed del admin no puede ejecutarse.');
            return;
        }

        var usuarios = leerUsuarios();

        if (yaExisteAdmin(usuarios)) {
            // Ya existe — no hacer nada para no sobreescribir datos reales
            return;
        }

        try {
            var hashData = await Hash.crearHash(ADMIN_PASS);

            var adminUser = {
                id:        generarIdAdmin(),
                nombre:    ADMIN_NOMBRE,
                email:     ADMIN_EMAIL,
                salt:      hashData.salt,
                hash:      hashData.hash,
                role:      'admin',
                creadoEn:  new Date().toISOString()
            };

            usuarios.push(adminUser);
            guardarUsuarios(usuarios);

            console.info(
                '[Prana] ✓ Usuario administrador creado.\n' +
                '  Email:      ' + ADMIN_EMAIL + '\n' +
                '  Contraseña: ' + ADMIN_PASS  + '\n' +
                '  (Solo para desarrollo/demo — no usar en producción)'
            );
        } catch (err) {
            console.error('[AdminSeed] Error al crear el admin:', err);
        }
    }

    // ── Exponer la función para que dashboard.html y login.html la invoquen ──
    // Se llama en DOMContentLoaded para garantizar que Hash ya cargó.
    window.AdminSeed = { sembrar: sembrarAdminSiNecesario };

    // Auto-ejecución si el DOM ya está listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sembrarAdminSiNecesario);
    } else {
        // Si el script se carga después de DOMContentLoaded (async/defer)
        sembrarAdminSiNecesario();
    }

})();
