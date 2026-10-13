// js/services/auth.js
// Responsabilidad: orquestar toda la lógica de autenticación.
//
// DISEÑO PARA ESCALABILIDAD:
// Este módulo expone una API PÚBLICA estable (register, login, logout,
// getCurrentUser, isAuthenticated, onChange). Internamente usa un adaptador
// de almacenamiento que actualmente es localStorage (a través de la utilidad
// Storage). Para migrar a Supabase / Firebase / API REST, basta con reemplazar
// la implementación interna manteniendo la misma API pública: el resto de la
// aplicación (modal, guard, navbar) no necesita cambios.
//
// Dependencias: utils/storage.js, utils/hash.js
// Debe cargarse DESPUÉS de ambas.

var AuthService = (function () {

    'use strict';

    // ── Claves de almacenamiento ────────────────────────────────────────────
    var KEY_USUARIOS  = 'prana_usuarios';   // Array de usuarios registrados
    var KEY_SESION    = 'prana_sesion';     // Sesión actual (token + usuario)

    // ── Duración de la sesión ───────────────────────────────────────────────
    var DURACION_SESION_MS = 1000 * 60 * 60 * 24; // 24 horas

    // ── Suscriptores de cambios de estado ───────────────────────────────────
    var suscriptores = [];

    // ── Helpers internos ────────────────────────────────────────────────────

    /**
     * Lee el array de usuarios del almacenamiento.
     * @returns {Array}
     */
    function obtenerUsuarios() {
        var crudos = Storage.obtener(KEY_USUARIOS, null);
        if (!crudos) return [];
        try {
            return JSON.parse(crudos);
        } catch (e) {
            return [];
        }
    }

    /**
     * Guarda el array de usuarios.
     */
    function guardarUsuarios(usuarios) {
        Storage.guardar(KEY_USUARIOS, JSON.stringify(usuarios));
    }

    /**
     * Genera un token simulado tipo JWT (header.payload.signature en base64).
     * No es un JWT real firmado criptográficamente, pero simula su estructura
     * y expiración para que la app pueda validar sesiones.
     */
    function generarToken(usuario) {
        var header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        var payload = btoa(JSON.stringify({
            sub: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            iat: Date.now(),
            exp: Date.now() + DURACION_SESION_MS
        }));
        // Firma simulada (en producción usaría HMAC en servidor)
        var firma = btoa('prana_' + usuario.id + '_' + Date.now());
        return header + '.' + payload + '.' + firma;
    }

    /**
     * Decodifica el payload del token.
     */
    function decodificarPayload(token) {
        try {
            var partes = token.split('.');
            if (partes.length !== 3) return null;
            return JSON.parse(atob(partes[1]));
        } catch (e) {
            return null;
        }
    }

    /**
     * Notifica a todos los suscriptores del cambio de estado.
     */
    function notificarCambio() {
        var usuario = getCurrentUser();
        suscriptores.forEach(function (cb) {
            try { cb(usuario); } catch (e) { /* ignora errores de callbacks */ }
        });
    }

    /**
     * Genera un ID único simple (UUID v4 simulado).
     */
    function generarId() {
        return 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    }

    /**
     * Normaliza un email (minúsculas, sin espacios).
     */
    function normalizarEmail(email) {
        return String(email || '').trim().toLowerCase();
    }

    // ── API PÚBLICA ─────────────────────────────────────────────────────────

    /**
     * Registra un nuevo usuario.
     * @param {Object} datos - { nombre, email, password }
     * @returns {Promise<{ok: boolean, mensaje?: string, usuario?: Object}>}
     */
    async function registrar(datos) {
        var nombre = String(datos.nombre || '').trim();
        var email = normalizarEmail(datos.email);
        var password = String(datos.password || '');

        // Validaciones básicas (el modal también valida, pero aquí se refuerza)
        if (!nombre || !email || !password) {
            return { ok: false, mensaje: 'Todos los campos son obligatorios.' };
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { ok: false, mensaje: 'El correo electrónico no tiene un formato válido.' };
        }
        if (password.length < 6) {
            return { ok: false, mensaje: 'La contraseña debe tener al menos 6 caracteres.' };
        }

        var usuarios = obtenerUsuarios();

        // Verificar email duplicado
        var existe = usuarios.some(function (u) { return u.email === email; });
        if (existe) {
            return { ok: false, mensaje: 'Ya existe una cuenta con este correo electrónico.' };
        }

        // Hashear la contraseña
        var hashData = await Hash.crearHash(password);

        var nuevoUsuario = {
            id: generarId(),
            nombre: nombre,
            email: email,
            salt: hashData.salt,
            hash: hashData.hash,
            creadoEn: new Date().toISOString()
        };

        usuarios.push(nuevoUsuario);
        guardarUsuarios(usuarios);

        // Retornar el usuario SIN los campos sensibles
        var usuarioSeguro = {
            id: nuevoUsuario.id,
            nombre: nuevoUsuario.nombre,
            email: nuevoUsuario.email,
            creadoEn: nuevoUsuario.creadoEn
        };

        return { ok: true, mensaje: 'Cuenta creada exitosamente. ¡Bienvenido a Prana!', usuario: usuarioSeguro };
    }

    /**
     * Inicia sesión con email y contraseña.
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{ok: boolean, mensaje?: string, usuario?: Object, token?: string}>}
     */
    async function iniciarSesion(email, password) {
        email = normalizarEmail(email);
        password = String(password || '');

        if (!email || !password) {
            return { ok: false, mensaje: 'Ingresa tu correo y contraseña.' };
        }

        var usuarios = obtenerUsuarios();
        var usuario = usuarios.find(function (u) { return u.email === email; });

        if (!usuario) {
            return { ok: false, mensaje: 'No existe una cuenta con este correo electrónico.' };
        }

        var coincide = await Hash.verificarPassword(password, usuario.salt, usuario.hash);
        if (!coincide) {
            return { ok: false, mensaje: 'Contraseña incorrecta. Inténtalo de nuevo.' };
        }

        var token = generarToken(usuario);
        var usuarioSeguro = {
            id:     usuario.id,
            nombre: usuario.nombre,
            email:  usuario.email,
            // IMPORTANTE: el rol debe viajar en la sesión para que el dashboard
            // pueda leerlo sin acceder de nuevo a prana_usuarios.
            role:   usuario.role || 'cliente'
        };

        // Persistir sesión
        Storage.guardar(KEY_SESION, JSON.stringify({ token: token, usuario: usuarioSeguro }));

        notificarCambio();

        return { ok: true, usuario: usuarioSeguro, token: token };
    }

    /**
     * Cierra la sesión actual.
     */
    function cerrarSesion() {
        Storage.eliminar(KEY_SESION);
        notificarCambio();
    }

    /**
     * Devuelve el usuario actual si hay una sesión válida, o null.
     * @returns {Object|null}
     */
    function getCurrentUser() {
        var crudo = Storage.obtener(KEY_SESION, null);
        if (!crudo) return null;

        var sesion;
        try {
            sesion = JSON.parse(crudo);
        } catch (e) {
            return null;
        }

        if (!sesion || !sesion.token || !sesion.usuario) return null;

        var payload = decodificarPayload(sesion.token);
        if (!payload) return null;

        // Verificar expiración
        if (payload.exp && payload.exp < Date.now()) {
            Storage.eliminar(KEY_SESION);
            return null;
        }

        return sesion.usuario;
    }

    /**
     * Indica si hay un usuario autenticado.
     * @returns {boolean}
     */
    function estaAutenticado() {
        return getCurrentUser() !== null;
    }

    /**
     * Suscribe un callback a los cambios de estado de autenticación.
     * @param {Function} callback - Recibe el usuario actual (o null)
     * @returns {Function} Función para desuscribirse
     */
    function onChange(callback) {
        if (typeof callback !== 'function') return function () {};
        suscriptores.push(callback);
        // Devolver función de desuscripción
        return function () {
            suscriptores = suscriptores.filter(function (cb) { return cb !== callback; });
        };
    }

    // Exponer API pública
    return {
        registrar: registrar,
        iniciarSesion: iniciarSesion,
        cerrarSesion: cerrarSesion,
        getCurrentUser: getCurrentUser,
        estaAutenticado: estaAutenticado,
        onChange: onChange
    };

})();
