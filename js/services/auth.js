// js/services/auth.js
// Responsabilidad: orquestar toda la lógica de autenticación.
//
// DISEÑO PARA ESCALABILIDAD:
// Este módulo expone una API PÚBLICA estable (register, login, logout,
// getCurrentUser, isAuthenticated, onChange). Funciona 100% con Supabase.
//
// Dependencias: utils/storage.js, utils/hash.js, services/supabaseClient.js
// Debe cargarse DESPUÉS de todas.
//
// NOTA: Este servicio funciona exclusivamente con Supabase. No hay fallback a localStorage.
// El token de sesión se guarda en localStorage solo para persistencia de sesión entre recargas.

var AuthService = (function () {

    'use strict';

    // ── Claves de almacenamiento ────────────────────────────────────────────
    var KEY_SESION    = 'prana_sesion';     // Sesión actual (token + usuario)

    // ── Duración de la sesión ───────────────────────────────────────────────
    var DURACION_SESION_MS = 1000 * 60 * 60 * 24; // 24 horas

    // ── Suscriptores de cambios de estado ───────────────────────────────────
    var suscriptores = [];

    // ── Helpers internos ────────────────────────────────────────────────────

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
        if (!window.supabaseClient) {
            return { ok: false, mensaje: 'Error: Supabase no está inicializado. Verifica tu conexión a internet.' };
        }

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

        try {
            console.log('[AuthService] Registrando usuario en Supabase:', email);

            // Verificar si ya existe en Supabase
            var { data: existe, error: errorCheck } = await window.supabaseClient
                .from('users')
                .select('email')
                .eq('email', email)
                .single();

            if (existe) {
                console.error('[AuthService] Email ya existe en Supabase');
                return { ok: false, mensaje: 'Ya existe una cuenta con este correo electrónico.' };
            }

            // Hashear la contraseña
            var hashData = await Hash.crearHash(password);

            // Insertar en Supabase
            var { data, error } = await window.supabaseClient
                .from('users')
                .insert({
                    name: nombre,
                    email: email,
                    password_hash: hashData.hash,
                    salt: hashData.salt,
                    role: 'cliente'
                })
                .select()
                .single();

            if (error) {
                console.error('[AuthService] Error al registrar en Supabase:', error);
                return { ok: false, mensaje: 'Error al crear la cuenta: ' + error.message };
            }

            console.log('[AuthService] Usuario registrado en Supabase:', data.email);

            var usuarioCreado = {
                id: data.id,
                nombre: data.name,
                email: data.email,
                role: data.role || 'cliente',
                creadoEn: data.created_at
            };

            // Retornar el usuario SIN los campos sensibles
            var usuarioSeguro = {
                id: usuarioCreado.id,
                nombre: usuarioCreado.nombre,
                email: usuarioCreado.email,
                role: usuarioCreado.role,
                creadoEn: usuarioCreado.creadoEn
            };

            return { ok: true, mensaje: 'Cuenta creada exitosamente. ¡Bienvenido a Prana!', usuario: usuarioSeguro };
        } catch (e) {
            console.error('[AuthService] Excepción al registrar usuario:', e);
            return { ok: false, mensaje: 'Error inesperado al crear la cuenta. Por favor, inténtalo de nuevo.' };
        }
    }

    /**
     * Inicia sesión con email y contraseña.
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{ok: boolean, mensaje?: string, usuario?: Object, token?: string}>}
     */
    async function iniciarSesion(email, password) {
        if (!window.supabaseClient) {
            return { ok: false, mensaje: 'Error: Supabase no está inicializado. Verifica tu conexión a internet.' };
        }

        email = normalizarEmail(email);
        password = String(password || '');

        if (!email || !password) {
            return { ok: false, mensaje: 'Ingresa tu correo y contraseña.' };
        }

        try {
            console.log('[AuthService] Buscando usuario en Supabase:', email);
            var { data, error } = await window.supabaseClient
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (error) {
                console.error('[AuthService] Error de Supabase al buscar usuario:', error);
                if (error.code === 'PGRST116') {
                    // No rows returned - usuario no existe
                    return { ok: false, mensaje: 'No existe una cuenta con este correo electrónico.' };
                }
                return { ok: false, mensaje: 'Error al buscar usuario: ' + error.message };
            }

            if (!data) {
                console.error('[AuthService] Usuario no encontrado en Supabase');
                return { ok: false, mensaje: 'No existe una cuenta con este correo electrónico.' };
            }

            console.log('[AuthService] Usuario encontrado en Supabase:', data.email);

            // Verificar contraseña usando el hash almacenado
            if (!data.password_hash || !data.salt) {
                console.error('[AuthService] Usuario en Supabase no tiene hash/salt');
                return { ok: false, mensaje: 'Error en la configuración del usuario. Contacta al soporte.' };
            }

            var coincide = await Hash.verificarPassword(password, data.salt, data.password_hash);
            if (!coincide) {
                console.error('[AuthService] Contraseña incorrecta (Supabase)');
                return { ok: false, mensaje: 'Contraseña incorrecta. Inténtalo de nuevo.' };
            }

            console.log('[AuthService] Contraseña verificada correctamente en Supabase');

            var usuario = {
                id: data.id,
                nombre: data.name,
                email: data.email,
                role: data.role || 'cliente'
            };

            var token = generarToken(usuario);
            var usuarioSeguro = {
                id:     usuario.id,
                nombre: usuario.nombre,
                email:  usuario.email,
                role:   usuario.role || 'cliente'
            };

            // Persistir sesión en localStorage (solo para persistencia entre recargas)
            Storage.guardar(KEY_SESION, JSON.stringify({ token: token, usuario: usuarioSeguro }));

            notificarCambio();

            console.log('[AuthService] Sesión iniciada exitosamente para:', usuarioSeguro.email);
            return { ok: true, usuario: usuarioSeguro, token: token };
        } catch (e) {
            console.error('[AuthService] Excepción al iniciar sesión:', e);
            return { ok: false, mensaje: 'Error inesperado al iniciar sesión. Por favor, inténtalo de nuevo.' };
        }
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
