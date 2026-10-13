// js/components/auth-guard.js
// Responsabilidad: proteger vistas y sincronizar el estado de autenticación
// con la UI (navbar, botones, secciones protegidas).
//
// Mecanismos de protección:
// - Elementos con [data-require-auth] se muestran SOLO si el usuario está logueado.
// - Elementos con [data-require-guest] se muestran SOLO si el usuario NO está logueado.
// - La función requireAuth() puede usarse programáticamente antes de acciones
//   que necesiten sesión (ej: ver perfil, finalizar compra).
//
// Dependencias: services/auth.js (cargado antes).

var AuthGuard = (function () {

    'use strict';

    /**
     * Actualiza todos los elementos protegidos según el estado de sesión.
     * Se ejecuta al cargar y cada vez que cambia el estado de autenticación.
     */
    function actualizarVistas() {
        var estaLogueado = AuthService.estaAutenticado();
        var usuario = AuthService.getCurrentUser();

        // ── Elementos que requieren autenticación ──────────────────────────
        document.querySelectorAll('[data-require-auth]').forEach(function (el) {
            el.style.display = estaLogueado ? '' : 'none';
        });

        // ── Elementos que requieren ser invitado ───────────────────────────
        document.querySelectorAll('[data-require-guest]').forEach(function (el) {
            el.style.display = estaLogueado ? 'none' : '';
        });

        // ── Navbar: nombre de usuario y menú ──────────────────────────────
        var nombreUsuarioEls = document.querySelectorAll('[data-auth-nombre]');
        nombreUsuarioEls.forEach(function (el) {
            el.textContent = usuario ? usuario.nombre : '';
        });

        var emailUsuarioEls = document.querySelectorAll('[data-auth-email]');
        emailUsuarioEls.forEach(function (el) {
            el.textContent = usuario ? usuario.email : '';
        });

        // Iniciales del usuario para el avatar
        var avatarEls = document.querySelectorAll('[data-auth-avatar]');
        avatarEls.forEach(function (el) {
            if (usuario) {
                var iniciales = usuario.nombre
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(function (p) { return p.charAt(0).toUpperCase(); })
                    .join('');
                el.textContent = iniciales || 'U';
            }
        });
    }

    /**
     * Verifica si el usuario está autenticado. Si no lo está, abre el modal
     * de login y retorna false. Útil para proteger acciones programáticas.
     *
     * @returns {boolean} true si está autenticado
     */
    function requireAuth() {
        if (AuthService.estaAutenticado()) return true;
        if (typeof AuthModal !== 'undefined' && AuthModal.abrir) {
            AuthModal.abrir('login');
        }
        return false;
    }

    /**
     * Cierra la sesión y actualiza la UI.
     */
    function logout() {
        AuthService.cerrarSesion();
        actualizarVistas();
    }

    // ── Inicialización ──────────────────────────────────────────────────────

    function iniciar() {
        // Actualizar estado inicial
        actualizarVistas();

        // Suscribirse a cambios de estado de autenticación
        AuthService.onChange(actualizarVistas);

        // Botones de logout (cualquier elemento con data-auth-logout)
        document.querySelectorAll('[data-auth-logout]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                logout();
                cerrarDropdown();
            });
        });

        // Toggle del dropdown del menú de usuario
        var avatarBtn = document.getElementById('auth-avatar-btn');
        var dropdown = document.getElementById('auth-dropdown');
        if (avatarBtn && dropdown) {
            avatarBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                dropdown.classList.toggle('auth-dropdown--abierto');
            });
            avatarBtn.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    dropdown.classList.toggle('auth-dropdown--abierto');
                }
            });
            // Cerrar al hacer clic fuera
            document.addEventListener('click', function (e) {
                if (!dropdown.contains(e.target) && e.target !== avatarBtn) {
                    dropdown.classList.remove('auth-dropdown--abierto');
                }
            });
        }

        // Enlace "Mi Panel" → dashboard.html
        // Si el href ya apunta a dashboard.html (index.html) se navega directo.
        // Si el href es "#" (subpáginas antiguas), se redirige a la ruta correcta.
        var perfilLinks = document.querySelectorAll('[data-auth-perfil]');
        perfilLinks.forEach(function (el) {
            el.addEventListener('click', function (e) {
                var href = (el.getAttribute('href') || '').trim();

                // href real y distinto de "#" → dejar que el navegador maneje el clic
                if (href && href !== '#') {
                    cerrarDropdown();
                    return; // navegación nativa del <a>
                }

                // href="#" (subpáginas): calcular la ruta relativa al dashboard
                e.preventDefault();
                cerrarDropdown();

                // Detectar si estamos dentro de /paginas/ para ajustar la ruta
                var path      = window.location.pathname;
                var enSubpag  = path.indexOf('/paginas/') !== -1 ||
                                path.indexOf('\\paginas\\') !== -1;
                var destino   = enSubpag ? '../dashboard.html' : 'dashboard.html';
                window.location.href = destino;
            });
        });
    }

    function cerrarDropdown() {
        var dropdown = document.getElementById('auth-dropdown');
        if (dropdown) dropdown.classList.remove('auth-dropdown--abierto');
    }

    // API pública
    return {
        iniciar: iniciar,
        actualizarVistas: actualizarVistas,
        requireAuth: requireAuth,
        logout: logout
    };

})();
