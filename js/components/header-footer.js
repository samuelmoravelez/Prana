// js/components/header-footer.js
// ============================================================================
// CABECERA Y PIE DE PÁGINA GLOBALES — Prana Fitness
// ============================================================================
// Inyecta dinámicamente el header (barra de anuncio + navbar) y el footer en
// cualquier página HTML que declare los contenedores:
//
//     <div id="global-header"></div>
//     <div id="global-footer"></div>
//
// CARACTERÍSTICAS
//   · Calcula el prefijo relativo ("../" dentro de /paginas/, "" en la raíz)
//     para que todos los enlaces funcionen desde cualquier nivel de carpetas.
//   · Marca automáticamente el enlace activo del menú según la URL actual.
//   · Renderiza "Ingresar" o el avatar con menú (Mi Panel / Cerrar Sesión)
//     según el estado de la sesión (prana_sesion en localStorage).
//   · Centraliza los datos de marca y contacto en un único objeto (MARCA).
//
// DEPENDENCIAS (cargar ANTES de este archivo)
//   utils/storage.js, services/auth.js, components/carrito.js
//
// ORDEN DE CARGA
//   Debe cargarse ANTES de main.js (que inicializa AuthGuard sobre el DOM
//   ya inyectado).
// ============================================================================

var GlobalLayout = (function () {
    'use strict';

    // ── Prefijo relativo según la profundidad de la página ──────────────────
    // /index.html → ''      |      /paginas/productos.html → '../'
    var P = /\/paginas\//.test(window.location.pathname.replace(/\\/g, '/')) ? '../' : '';

    // ── Datos de marca y contacto (fuente única de verdad) ──────────────────
    var MARCA = {
        logo:      'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png',
        instagram: 'https://www.instagram.com/',
        tiktok:    'https://www.tiktok.com/',
        whatsapp:  'https://wa.me/573332359677',
        telefono:  '+57 300 309 1641',
        telLink:   'tel:+573332359677',
        email:     'contacto@marcafitness.co'
    };

    // ── Menú de navegación (única definición para header y footer) ──────────
    var NAV = [
        { texto: 'Inicio',        href: P + 'index.html',                 archivo: 'index.html' },
        { texto: 'Quiénes Somos', href: P + 'paginas/quienes-somos.html', archivo: 'quienes-somos.html' },
        { texto: 'Productos',     href: P + 'paginas/productos.html',     archivo: 'productos.html' },
        { texto: 'Servicios',     href: P + 'paginas/servicios.html',     archivo: 'servicios.html' },
        { texto: 'Blog',          href: P + 'paginas/blog.html',          archivo: 'blog.html' },
        { texto: 'Contáctanos',   href: P + 'paginas/contactanos.html',   archivo: 'contactanos.html' }
    ];

    // ── Helpers ─────────────────────────────────────────────────────────────

    /** Devuelve el nombre del archivo HTML actual (ej. "productos.html"). */
    function _archivoActual() {
        var ruta = window.location.pathname.replace(/\\/g, '/');
        return ruta.substring(ruta.lastIndexOf('/') + 1) || 'index.html';
    }

    /**
     * Devuelve el usuario de la sesión activa o null.
     * Usa AuthService si está disponible; si no, lee prana_sesion directamente.
     */
    function _usuario() {
        if (typeof AuthService !== 'undefined' && AuthService.getCurrentUser) {
            try { return AuthService.getCurrentUser(); } catch (e) { /* usa fallback */ }
        }
        try {
            var raw = localStorage.getItem('prana_sesion');
            if (!raw) return null;
            var sesion = JSON.parse(raw);
            return (sesion && sesion.usuario) ? sesion.usuario : null;
        } catch (e) {
            return null;
        }
    }

    /** Iniciales del nombre para el avatar (máx. 2 letras). */
    function _iniciales(nombre) {
        var ini = String(nombre || '')
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(function (palabra) { return palabra.charAt(0).toUpperCase(); })
            .join('');
        return ini || 'U';
    }

    /** Ítems del menú principal con el enlace activo marcado. */
    function _navItems() {
        var actual = _archivoActual();
        return NAV.map(function (item) {
            var activo = (item.archivo === actual);
            return '<li class="nav-item">' +
                     '<a class="nav-link' + (activo ? ' active' : '') + '"' +
                       (activo ? ' aria-current="page"' : '') +
                       ' href="' + item.href + '">' + item.texto + '</a>' +
                   '</li>';
        }).join('');
    }

    /** Ítems de navegación del footer. */
    function _navFooter() {
        return NAV.map(function (item) {
            return '<li class="mb-2">' +
                     '<a href="' + item.href + '" class="text-light text-decoration-none hover-text-success transition">' +
                       item.texto +
                     '</a>' +
                   '</li>';
        }).join('');
    }

    // ── Plantillas de HTML ──────────────────────────────────────────────────

    function _headerHTML() {
        var usuario   = _usuario();
        var logueado  = !!usuario;
        var iniciales = logueado ? _iniciales(usuario.nombre) : '';
        var nombre    = logueado ? (usuario.nombre || '') : '';
        var email     = logueado ? (usuario.email  || '') : '';

        return '' +
        '<!-- Barra de anuncio global -->' +
        '<div class="barra-anuncio bg-success text-white text-center py-2">' +
          '<p class="mb-0"><i class="ri-flashlight-fill me-2"></i> ¡Envíos gratis a todo el país desde $150.000! Escríbenos a nuestro WhatsApp <i class="ri-flashlight-fill ms-2"></i></p>' +
        '</div>' +

        '<!-- Header / Navbar global -->' +
        '<header>' +
        '<nav class="navbar navbar-expand-lg navbar-light bg-light sticky-top shadow-sm">' +
          '<div class="container">' +
            '<!-- Logo (enlace al inicio) -->' +
            '<a class="navbar-brand fw-bold" href="' + P + 'index.html">' +
              '<img src="' + MARCA.logo + '" alt="Logo de la marca fitness" width="44" height="44" class="logo-imagen d-inline-block align-text-top me-2">' +
            '</a>' +
            '<!-- Botón hamburguesa (móvil) -->' +
            '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Abrir menú de navegación">' +
              '<span class="navbar-toggler-icon"></span>' +
            '</button>' +
            '<div class="collapse navbar-collapse" id="navbarNav">' +
              '<!-- Navegación principal -->' +
              '<ul class="navbar-nav ms-auto">' + _navItems() + '</ul>' +
              '<!-- Carrito con badge -->' +
              '<ul class="navbar-nav ms-3">' +
                '<li class="nav-item position-relative">' +
                  '<a class="nav-link" href="' + P + 'carrito.html" aria-label="Ver carrito de compras">' +
                    '<i class="ri-shopping-cart-fill fs-5"></i>' +
                    '<span class="badge bg-danger position-absolute top-0 start-100 translate-middle contador-carrito">0</span>' +
                  '</a>' +
                '</li>' +
              '</ul>' +
              '<!-- Sesión: invitado o usuario autenticado -->' +
              '<ul class="navbar-nav ms-3 align-items-center">' +
                '<li class="nav-item" data-require-guest' + (logueado ? ' style="display:none;"' : '') + '>' +
                  '<a href="' + P + 'login.html" class="auth-boton-acceso">' +
                    '<i class="ri-user-line"></i><span class="d-none d-sm-inline">Ingresar</span>' +
                  '</a>' +
                '</li>' +
                '<li class="nav-item auth-usuario-menu" data-require-auth' + (logueado ? '' : ' style="display:none;"') + '>' +
                  '<div class="auth-avatar" data-auth-avatar id="auth-avatar-btn" role="button" tabindex="0" aria-label="Menú de usuario">' + iniciales + '</div>' +
                  '<div class="auth-dropdown" id="auth-dropdown">' +
                    '<div class="auth-dropdown-header">' +
                      '<p class="auth-dropdown-nombre" data-auth-nombre>' + nombre + '</p>' +
                      '<p class="auth-dropdown-email" data-auth-email>' + email + '</p>' +
                    '</div>' +
                    '<a href="' + P + 'dashboard.html" class="auth-dropdown-item" data-auth-perfil>' +
                      '<i class="ri-dashboard-line"></i> Mi Panel' +
                    '</a>' +
                    '<div class="auth-dropdown-divider"></div>' +
                    '<button class="auth-dropdown-item auth-dropdown-item--logout" data-auth-logout>' +
                      '<i class="ri-logout-box-r-line"></i> Cerrar Sesión' +
                    '</button>' +
                  '</div>' +
                '</li>' +
              '</ul>' +
            '</div>' +
          '</div>' +
        '</nav>' +
        '</header>';
    }

    function _footerHTML() {
        return '' +
        '<footer class="bg-dark text-light py-5">' +
          '<div class="container">' +
            '<div class="row g-4 mb-4">' +
              '<!-- Columna 1: marca + redes -->' +
              '<div class="col-lg-3 col-md-6">' +
                '<a href="' + P + 'index.html" class="d-flex align-items-center text-decoration-none mb-3">' +
                  '<img src="' + MARCA.logo + '" alt="Logo de la marca fitness" width="40" height="40" class="logo-imagen me-2">' +
                  '<h4 class="fw-bold mb-0 text-light">Prana</h4>' +
                '</a>' +
                '<p class="text-muted small">Tu tienda fitness de confianza en Medellín. Suplementos deportivos, indumentaria técnica, accesorios y equipamiento gym profesional.</p>' +
                '<div class="d-flex gap-3 mt-3">' +
                  '<a href="' + MARCA.instagram + '" target="_blank" rel="noopener noreferrer" aria-label="Instagram" class="text-light text-decoration-none fs-5 hover-text-success transition"><i class="fab fa-instagram"></i></a>' +
                  '<a href="' + MARCA.tiktok + '" target="_blank" rel="noopener noreferrer" aria-label="TikTok" class="text-light text-decoration-none fs-5 hover-text-success transition"><i class="fab fa-tiktok"></i></a>' +
                  '<a href="' + MARCA.whatsapp + '" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" class="text-light text-decoration-none fs-5 hover-text-success transition"><i class="fab fa-whatsapp"></i></a>' +
                '</div>' +
              '</div>' +
              '<!-- Columna 2: navegación -->' +
              '<div class="col-lg-3 col-md-6">' +
                '<h5 class="fw-bold mb-3 text-success">Navegación</h5>' +
                '<ul class="list-unstyled">' + _navFooter() + '</ul>' +
              '</div>' +
              '<!-- Columna 3: contacto -->' +
              '<div class="col-lg-3 col-md-6">' +
                '<h5 class="fw-bold mb-3 text-success">Contacto</h5>' +
                '<ul class="list-unstyled">' +
                  '<li class="mb-2"><i class="ri-map-pin-fill text-success me-2"></i><span class="text-muted small">Medellín, Colombia</span></li>' +
                  '<li class="mb-2"><i class="ri-phone-fill text-success me-2"></i><a href="' + MARCA.telLink + '" class="text-light text-decoration-none hover-text-success transition small">' + MARCA.telefono + '</a></li>' +
                  '<li class="mb-2"><i class="ri-mail-fill text-success me-2"></i><a href="mailto:' + MARCA.email + '" class="text-light text-decoration-none hover-text-success transition small">' + MARCA.email + '</a></li>' +
                  '<li><i class="ri-time-fill text-success me-2"></i><span class="text-muted small">Lun–Sáb: 8am – 8pm</span></li>' +
                '</ul>' +
              '</div>' +
              '<!-- Columna 4: newsletter -->' +
              '<div class="col-lg-3 col-md-6">' +
                '<h5 class="fw-bold mb-3 text-success">Newsletter Fitness</h5>' +
                '<p class="text-muted small mb-3">Suscríbete para recibir tips de entrenamiento, descuentos exclusivos y lanzamientos.</p>' +
                '<div class="input-group mb-2">' +
                  '<input type="email" class="form-control" placeholder="Tu email" aria-label="Tu email">' +
                  '<button class="btn btn-success" type="button" aria-label="Suscribirse"><i class="ri-send-plane-fill"></i></button>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<hr class="bg-secondary">' +
            '<div class="row text-center text-md-start">' +
              '<div class="col-md-6 mb-2 mb-md-0"><p class="text-muted small mb-0">© 2026 De Prana. Todos los derechos reservados.</p></div>' +
              '<div class="col-md-6"><p class="text-muted small mb-0">Hecho con <i class="ri-heart-fill text-danger"></i> en Medellín — Año 2026</p></div>' +
            '</div>' +
          '</div>' +
        '</footer>';
    }

    // ── Inyección ───────────────────────────────────────────────────────────

    function inyectar() {
        var headerEl = document.getElementById('global-header');
        var footerEl = document.getElementById('global-footer');

        if (headerEl) headerEl.innerHTML = _headerHTML();
        if (footerEl) footerEl.innerHTML = _footerHTML();

        // Sincronizar el badge del carrito con los elementos ya inyectados
        if (typeof CarritoService !== 'undefined' && CarritoService.iniciar) {
            CarritoService.iniciar();
        }
    }

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', inyectar);
        } else {
            inyectar();
        }
    }

    init();

    // API pública (permite reinyectar manualmente si se necesita)
    return { inyectar: inyectar };

})();
