/**
 * js/dashboard/dashboard-auth.js
 * Verificación de sesión de Supabase/AuthService, roles (admin/cliente) y flujo de logout.
 */

import { DToast } from './dashboard-common.js';

/**
 * Verifica la existencia y validez de la sesión activa.
 * Redirige a login.html si no está autenticado o la sesión es inválida.
 * @returns {Object|null} Objeto del usuario autenticado
 */
export function verificarSesion() {
    if (typeof AuthService === 'undefined') {
        console.error('[dashboard-auth] AuthService no disponible. Revisa el orden de scripts.');
        window.location.replace('login.html');
        return null;
    }

    if (!AuthService.estaAutenticado()) {
        try {
            sessionStorage.setItem('prana_login_retorno', window.location.href);
        } catch (e) {}
        window.location.replace('login.html');
        return null;
    }

    var usuario = AuthService.getCurrentUser();
    if (!usuario || !usuario.id) {
        try { AuthService.cerrarSesion(); } catch (e) {}
        window.location.replace('login.html');
        return null;
    }

    return usuario;
}

/**
 * Determina el rol del usuario ('admin' o 'cliente').
 * Prioridad de lectura:
 * 1. prana_sesion -> usuario.role
 * 2. prana_usuarios -> coincidencia de ID -> role
 * 3. 'cliente' por defecto
 * @param {Object} usuario 
 * @returns {string} 'admin' o 'cliente'
 */
export function obtenerRol(usuario) {
    if (!usuario || !usuario.id) return 'cliente';

    try {
        var raw = localStorage.getItem('prana_sesion');
        var ses = raw ? JSON.parse(raw) : null;
        if (ses && ses.usuario && typeof ses.usuario.role === 'string' && ses.usuario.role.length > 0) {
            return ses.usuario.role === 'admin' ? 'admin' : 'cliente';
        }
    } catch (e) {}

    try {
        var usuarios = JSON.parse(localStorage.getItem('prana_usuarios') || '[]');
        var dbUser = usuarios.find(function (u) { return String(u.id) === String(usuario.id); });
        if (dbUser && dbUser.role === 'admin') return 'admin';
    } catch (e) {}

    return 'cliente';
}

/**
 * Construye la barra superior y los datos de perfil en el sidebar según el rol.
 * @param {Object} usuario 
 * @param {string} rol 
 */
export function construirTopbar(usuario, rol) {
    if (!usuario) return;
    var nombre = usuario.nombre || usuario.name || 'Usuario';

    // Topbar nombre
    var el = document.getElementById('d-topbar-nombre');
    if (el) el.textContent = nombre.split(' ')[0];

    // Badge de rol
    var badgeEl  = document.getElementById('d-badge-rol');
    var badgeTxt = document.getElementById('d-badge-rol-text');
    if (badgeEl && badgeTxt) {
        badgeEl.className = 'd-badge-rol ' + rol;
        var iconEl = badgeEl.querySelector('i');
        if (iconEl) {
            iconEl.className = rol === 'admin' ? 'ri-shield-star-line' : 'ri-user-smile-line';
        }
        badgeTxt.textContent = rol === 'admin' ? 'Administrador' : 'Cliente';
    }

    // Sidebar user card
    var sAvatar = document.getElementById('d-sidebar-avatar');
    var sNombre = document.getElementById('d-sidebar-nombre');
    var sRol    = document.getElementById('d-sidebar-rol');
    var inits   = nombre.trim().split(' ').slice(0, 2).map(function(p){ return p[0]; }).join('').toUpperCase();
    if (sAvatar) sAvatar.textContent = inits;
    if (sNombre) sNombre.textContent = nombre;
    if (sRol) {
        sRol.textContent = rol === 'admin' ? 'Administrador' : 'Cliente';
        sRol.className   = 'd-sidebar__user-role ' + rol;
    }

    // Botón logout
    var logoutBtn = document.getElementById('d-btn-logout');
    if (logoutBtn) {
        logoutBtn.onclick = function (e) {
            if (e) e.preventDefault();
            if (typeof ModalConfirmacion !== 'undefined' && ModalConfirmacion.confirmarLogout) {
                ModalConfirmacion.confirmarLogout(cerrarSesion);
        

                return;
            }

            cerrarSesion();

        };
    }
}

/**
 * Cierra la sesión activa y redirige a login.html.
 */
export function cerrarSesion() {
    if (typeof AuthService !== 'undefined' && AuthService.cerrarSesion) {
        AuthService.cerrarSesion();
    } else {
        localStorage.removeItem('prana_sesion');
    }
    DToast.info('Sesión cerrada. Hasta pronto.');
    setTimeout(function () {
        window.location.replace('login.html');
    }, 800);
}
