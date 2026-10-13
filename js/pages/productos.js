// js/pages/productos.js
// Responsabilidad: lógica exclusiva de productos.html (catálogo).
// — Conecta los botones "Agregar al Carrito" con CarritoService
// — Conecta los botones "Me gusta" (corazón) con FavoritoService
// — Sincroniza el badge del header y los estados visuales de favoritos
//
// Dependencias: utils/storage.js, utils/hash.js, services/auth.js,
//               components/carrito.js

(function () {

    'use strict';

    // ── Catálogo de productos ────────────────────────────────────────────────
    // Fuente de verdad para persistir en carrito y favoritos.
    var CATALOGO = [
        {
            id:        'whey-protein-2kg',
            nombre:    'Whey Protein Premium 2kg',
            precio:    189000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239384/1111111.png',
            categoria: 'Suplementos'
        },
        {
            id:        'creatina-500g',
            nombre:    'Creatina Monohidratada 500g',
            precio:    95000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791237388/22.png',
            categoria: 'Suplementos'
        },
        {
            id:        'barras-proteicas-x12',
            nombre:    'Barras Proteicas Pack x12',
            precio:    82000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239559/222222-removebg-preview.png',
            categoria: 'Suplementos'
        },
        {
            id:        'leggings-hw',
            nombre:    'Leggings Compresión High-Waist',
            precio:    115000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239646/sdd.png',
            categoria: 'Indumentaria'
        },
        {
            id:        'sports-bra',
            nombre:    'Sports Bra Soporte Alto',
            precio:    89000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239713/rrrr.png',
            categoria: 'Indumentaria'
        },
        {
            id:        'sneakers-training-pro',
            nombre:    'Sneakers Training Pro',
            precio:    260000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791237492/33.png',
            categoria: 'Indumentaria'
        },
        {
            id:        'mancuernas-20kg',
            nombre:    'Mancuernas Ajustables 20kg (par)',
            precio:    489000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239824/ee-removebg-preview.png',
            categoria: 'Equipamiento'
        },
        {
            id:        'bandas-elasticas-x5',
            nombre:    'Bandas Elásticas Set x5 Niveles',
            precio:    45000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239903/eqw.png',
            categoria: 'Accesorios'
        },
        {
            id:        'shaker-pro-700ml',
            nombre:    'Shaker Mezclador Pro 700ml',
            precio:    32000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239962/fre.png',
            categoria: 'Accesorios'
        }
    ];

    // ════════════════════════════════════════════════════════════════════════
    // FAVORITO SERVICE — gestión de favoritos en localStorage
    // Clave: prana_favoritos_{userId}  (misma que usa dashboard.js)
    // Si el usuario no está autenticado, muestra un aviso y redirige al login.
    // ════════════════════════════════════════════════════════════════════════
    var FavoritoService = (function () {

        var KEY_PREFIX = 'prana_favoritos_';

        /** Devuelve el id del usuario autenticado, o null si no hay sesión. */
        function _obtenerUid() {
            try {
                if (typeof AuthService !== 'undefined' && AuthService.estaAutenticado()) {
                    var u = AuthService.getCurrentUser();
                    return (u && u.id) ? u.id : null;
                }
                // Fallback directo a localStorage
                var raw = localStorage.getItem('prana_sesion');
                if (!raw) return null;
                var ses = JSON.parse(raw);
                return (ses && ses.usuario && ses.usuario.id) ? ses.usuario.id : null;
            } catch (e) { return null; }
        }

        /** Lee la lista de favoritos del usuario activo. */
        function obtener() {
            var uid = _obtenerUid();
            if (!uid) return [];
            try {
                var raw = localStorage.getItem(KEY_PREFIX + uid);
                return raw ? JSON.parse(raw) : [];
            } catch (e) { return []; }
        }

        /** Guarda la lista completa. */
        function _guardar(uid, lista) {
            try { localStorage.setItem(KEY_PREFIX + uid, JSON.stringify(lista)); } catch (e) {}
        }

        /** Verifica si un producto está en favoritos. */
        function esFavorito(productoId) {
            return obtener().some(function (f) { return f.id === productoId; });
        }

        /**
         * Agrega o quita un producto de favoritos.
         * @param {Object} producto - ítem del catálogo { id, nombre, precio, imagen, categoria }
         * @returns {boolean|null} true=agregado, false=quitado, null=sin sesión
         */
        function toggle(producto) {
            var uid = _obtenerUid();
            if (!uid) return null; // sin sesión

            var lista = obtener();
            var idx   = lista.findIndex(function (f) { return f.id === producto.id; });

            if (idx >= 0) {
                lista.splice(idx, 1);  // quitar
                _guardar(uid, lista);
                return false;
            } else {
                lista.unshift({        // agregar al inicio
                    id:        producto.id,
                    nombre:    producto.nombre,
                    precio:    producto.precio,
                    imagen:    producto.imagen,
                    categoria: producto.categoria,
                    tipo:      'producto',
                    guardadoEn: new Date().toISOString()
                });
                _guardar(uid, lista);
                return true;
            }
        }

        return { obtener, esFavorito, toggle };

    })();

    // ── Helpers comunes ─────────────────────────────────────────────────────

    /** Busca el producto en el catálogo por data-producto-id. */
    function resolverProducto(boton) {
        var pid = boton.getAttribute('data-producto-id');
        return pid
            ? CATALOGO.find(function (p) { return p.id === pid; }) || null
            : null;
    }

    /** Feedback visual en el botón de carrito. */
    function animarBotonCarrito(boton) {
        var textoOriginal    = boton.innerHTML;
        var clasesOriginales = boton.className;
        boton.disabled  = true;
        boton.innerHTML = '<i class="ri-checkbox-circle-fill me-2"></i>¡Agregado!';
        boton.classList.add('btn-carrito--agregado');
        setTimeout(function () {
            boton.disabled  = false;
            boton.innerHTML = textoOriginal;
            boton.className = clasesOriginales;
        }, 1800);
    }

    /**
     * Actualiza el aspecto visual del botón de favorito según el estado actual.
     * @param {HTMLElement} boton
     * @param {boolean}     activo   — true si ya es favorito
     * @param {boolean}     animar   — true para añadir la animación de pulso
     */
    function sincronizarBotonFav(boton, activo, animar) {
        var icono = boton.querySelector('i');
        boton.classList.toggle('activo', activo);
        if (icono) {
            icono.className = activo ? 'ri-heart-fill' : 'ri-heart-line';
        }
        boton.setAttribute('aria-pressed', activo ? 'true' : 'false');
        boton.title = activo ? 'Quitar de favoritos' : 'Guardar en favoritos';

        if (animar) {
            boton.classList.remove('pulsando');
            void boton.offsetWidth; // reflow para reiniciar la animación CSS
            boton.classList.add('pulsando');
        }
    }

    /** Actualiza TODOS los botones de favorito al cargar la página. */
    function sincronizarTodosLosBotonesFav() {
        document.querySelectorAll('[data-accion="toggle-favorito"]').forEach(function (btn) {
            var pid    = btn.getAttribute('data-producto-id');
            var activo = pid ? FavoritoService.esFavorito(pid) : false;
            sincronizarBotonFav(btn, activo, false);
        });
    }

    // ── Inicialización ───────────────────────────────────────────────────────

    function init() {
        // ── Botones "Agregar al Carrito" ──────────────────────────────────
        if (typeof CarritoService !== 'undefined') {
            CarritoService.iniciar();
        }

        document.querySelectorAll('[data-accion="agregar-carrito"]').forEach(function (boton) {
            boton.addEventListener('click', function (e) {
                e.preventDefault();
                var producto = resolverProducto(boton);
                if (!producto) {
                    console.warn('[Prana] Producto no encontrado:', boton.getAttribute('data-producto-id'));
                    return;
                }
                if (typeof CarritoService !== 'undefined') {
                    CarritoService.agregar(producto);
                }
                animarBotonCarrito(boton);

                // Pulso en el badge del carrito
                document.querySelectorAll('.contador-carrito').forEach(function (b) {
                    b.classList.remove('carrito-badge--pulso');
                    void b.offsetWidth;
                    b.classList.add('carrito-badge--pulso');
                });
            });
        });

        // ── Botones "Me gusta" (corazón) ─────────────────────────────────
        // Sincronizar estado inicial (resalta los ya guardados)
        sincronizarTodosLosBotonesFav();

        document.querySelectorAll('[data-accion="toggle-favorito"]').forEach(function (boton) {
            boton.addEventListener('click', function (e) {
                e.preventDefault();
                var producto = resolverProducto(boton);
                if (!producto) return;

                var resultado = FavoritoService.toggle(producto);

                if (resultado === null) {
                    // Sin sesión → redirigir al login guardando retorno
                    try {
                        sessionStorage.setItem('prana_login_retorno', window.location.href);
                    } catch (_) {}
                    // Mini banner flotante en vez de alert
                    _mostrarAviso('Debes iniciar sesión para guardar favoritos.');
                    setTimeout(function () {
                        window.location.href = '../login.html';
                    }, 1800);
                    return;
                }

                // Actualizar el botón que fue clicado
                sincronizarBotonFav(boton, resultado, true);

                // Si hay más de un botón para el mismo producto (por si el catálogo
                // repite el item en otra vista), sincronizarlos todos
                var pid = boton.getAttribute('data-producto-id');
                document.querySelectorAll('[data-accion="toggle-favorito"][data-producto-id="' + pid + '"]')
                    .forEach(function (b) {
                        if (b !== boton) sincronizarBotonFav(b, resultado, false);
                    });

                // Aviso de confirmación
                if (resultado) {
                    _mostrarAviso('❤️ ' + producto.nombre + ' guardado en favoritos.', '#5C0A1B');
                } else {
                    _mostrarAviso('💔 ' + producto.nombre + ' eliminado de favoritos.', '#6B6B6B');
                }
            });
        });

        // Escuchar cambios de sesión desde otras pestañas (login en otra pestaña)
        window.addEventListener('storage', function (e) {
            if (e.key === 'prana_sesion') {
                sincronizarTodosLosBotonesFav();
            }
        });
    }

    // ── Aviso flotante (mini toast, sin dependencias externas) ───────────────
    function _mostrarAviso(mensaje, color) {
        var aviso = document.createElement('div');
        aviso.setAttribute('role', 'status');
        aviso.setAttribute('aria-live', 'polite');
        aviso.style.cssText = [
            'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9999',
            'background:' + (color || '#1A1A2E'),
            'color:#FFFFFF', 'border-radius:10px',
            'padding:12px 20px', 'font-size:0.88rem', 'font-weight:600',
            'box-shadow:0 8px 24px rgba(0,0,0,0.25)',
            'max-width:320px', 'line-height:1.4',
            'animation:fav-toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
            'font-family:Inter,sans-serif'
        ].join(';');
        aviso.textContent = mensaje;

        // Inyectar keyframes si no existen
        if (!document.getElementById('fav-toast-kf')) {
            var style = document.createElement('style');
            style.id  = 'fav-toast-kf';
            style.textContent =
                '@keyframes fav-toast-in{from{opacity:0;transform:translateX(30px) scale(.95)}to{opacity:1;transform:none}}' +
                '@keyframes fav-toast-out{to{opacity:0;transform:translateX(30px) scale(.95)}}';
            document.head.appendChild(style);
        }

        document.body.appendChild(aviso);
        setTimeout(function () {
            aviso.style.animation = 'fav-toast-out 0.3s ease both';
            setTimeout(function () {
                if (aviso.parentNode) aviso.parentNode.removeChild(aviso);
            }, 320);
        }, 2800);
    }

    // ── Arranque ─────────────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
