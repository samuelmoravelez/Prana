// js/pages/productos.js
// Responsabilidad: lógica exclusiva de productos.html (catálogo).
// — Renderizado dinámico de productos 100% desde Supabase (PostgreSQL)
// — Conexión con Supabase: window.supabaseClient.from('products').select('*')
// — Delegación de eventos para "Agregar al Carrito" (CarritoService) y "Favoritos" (Supabase)
// — Manejo de UUIDs dinámicos autogenerados por Supabase (sin slugs ni localStorage)
//
// Dependencias: services/supabaseClient.js, services/auth.js,
//               services/productos-store.js, components/carrito.js

(function () {

    'use strict';

    // ── Estado en memoria ───────────────────────────────────────────────────
    var _productosCargados = [];
    var _favoritosIds      = [];
    var _categoriaActual   = 'todos';
    var _cargando          = false;

    // ── Helpers de formato y seguridad ──────────────────────────────────────
    function formatoCOP(valor) {
        return '$' + Math.round(Number(valor) || 0).toLocaleString('es-CO');
    }

    function esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Notificaciones flotantes ────────────────────────────────────────────
    function _mostrarAviso(mensaje, color) {
        var aviso = document.createElement('div');
        aviso.setAttribute('role', 'status');
        aviso.style.cssText = [
            'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9999',
            'background:' + (color || '#1A1A2E'),
            'color:#FFFFFF', 'border-radius:10px',
            'padding:12px 20px', 'font-size:0.88rem', 'font-weight:600',
            'box-shadow:0 8px 24px rgba(0,0,0,0.25)',
            'max-width:320px', 'line-height:1.4',
            'font-family:Inter,sans-serif'
        ].join(';');
        aviso.textContent = mensaje;
        document.body.appendChild(aviso);
        setTimeout(function () {
            if (aviso.parentNode) aviso.parentNode.removeChild(aviso);
        }, 2500);
    }

    // ── Estados visuales: Spinner y Error ───────────────────────────────────
    function mostrarCargando() {
        var grid = document.getElementById('contenedor-productos') || document.querySelector('.productos-grid');
        if (!grid) return;
        grid.innerHTML = [
            '<div class="col-12 text-center py-5">',
            '  <div class="spinner-border text-success mb-3" role="status" style="width: 3rem; height: 3rem;">',
            '    <span class="visually-hidden">Cargando catálogo...</span>',
            '  </div>',
            '  <p class="text-muted fw-semibold">Cargando catálogo desde Supabase...</p>',
            '</div>'
        ].join('');
    }

    function mostrarError(mensaje) {
        var grid = document.getElementById('contenedor-productos') || document.querySelector('.productos-grid');
        if (!grid) return;
        grid.innerHTML = [
            '<div class="col-12 text-center py-5">',
            '  <i class="ri-error-warning-line display-4 text-danger mb-3 d-block"></i>',
            '  <h3 class="h5 fw-bold text-danger">Error al cargar productos</h3>',
            '  <p class="text-muted small">' + esc(mensaje) + '</p>',
            '  <button type="button" class="btn btn-outline-success btn-sm mt-2" id="btn-reintentar-prods">',
            '    <i class="ri-refresh-line me-1"></i> Reintentar',
            '  </button>',
            '</div>'
        ].join('');

        var btnReintentar = document.getElementById('btn-reintentar-prods');
        if (btnReintentar) {
            btnReintentar.addEventListener('click', function () {
                cargarDatosSupabase();
            });
        }
    }

    // ── Carga de datos 100% desde Supabase ──────────────────────────────────
    async function cargarDatosSupabase() {
        if (!window.supabaseClient) {
            console.warn('[Productos] supabaseClient aún no disponible.');
            return;
        }

        _cargando = true;
        mostrarCargando();

        try {
            // 1. Consulta directa a la tabla 'products' de Supabase
            var { data, error } = await window.supabaseClient
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[Productos] Error de Supabase al consultar products:', error);
                mostrarError('No fue posible conectar con la base de datos de productos.');
                _cargando = false;
                return;
            }

            _productosCargados = Array.isArray(data) ? data : [];

            // 2. Consulta de favoritos en Supabase para el usuario activo (si existe sesión)
            var usuario = (typeof AuthService !== 'undefined') ? AuthService.getCurrentUser() : null;
            if (usuario && usuario.id) {
                try {
                    var resFav = await window.supabaseClient
                        .from('favorites')
                        .select('product_id')
                        .eq('user_id', usuario.id);

                    if (resFav && !resFav.error && Array.isArray(resFav.data)) {
                        _favoritosIds = resFav.data.map(function (f) { return f.product_id; });
                    } else {
                        _favoritosIds = [];
                    }
                } catch (eFav) {
                    console.warn('[Productos] No se pudieron cargar favoritos de Supabase:', eFav);
                    _favoritosIds = [];
                }
            } else {
                _favoritosIds = [];
            }

            _cargando = false;
            renderizarGrilla();

        } catch (err) {
            _cargando = false;
            console.error('[Productos] Excepción inesperada al cargar desde Supabase:', err);
            mostrarError('Ocurrió un error inesperado al conectar con Supabase.');
        }
    }

    // ── Renderizado dinámico de tarjetas ────────────────────────────────────
    function renderizarGrilla() {
        var grid = document.getElementById('contenedor-productos') || document.querySelector('.productos-grid');
        if (!grid) return;

        // Filtrado dinámico por categoría
        var filtrados = _productosCargados.filter(function (p) {
            if (_categoriaActual === 'todos') return true;
            var catNormalizada = (p.category || '').toLowerCase().trim();
            var filtroNormalizado = _categoriaActual.toLowerCase().trim();
            return catNormalizada === filtroNormalizado || catNormalizada.indexOf(filtroNormalizado) >= 0;
        });

        if (filtrados.length === 0) {
            grid.innerHTML = [
                '<div class="col-12 text-center py-5">',
                '  <i class="ri-inbox-line display-3 text-muted mb-3 d-block"></i>',
                '  <h3 class="h5 fw-bold">No se encontraron productos en esta categoría</h3>',
                '  <p class="text-muted small">Pronto añadiremos más referencias a nuestro catálogo.</p>',
                '</div>'
            ].join('');
            return;
        }

        grid.innerHTML = filtrados.map(function (p) {
            // p.id es el UUID generado por Supabase
            var esFav = _favoritosIds.indexOf(p.id) >= 0;
            var catLabel = p.category ? (p.category.charAt(0).toUpperCase() + p.category.slice(1)) : 'Fitness';
            var catClase = (p.category || '').toLowerCase().replace(/[^a-z0-9]/g, '');

            // p.badge -> Etiqueta del producto (ej. "Nuevo", "Popular", "Destacado"). Si es nulo, no renderizar
            var badgeHtml = (p.badge && String(p.badge).trim())
                ? '<span class="etiqueta-producto badge bg-success position-absolute top-3 start-3" style="z-index:2;">' + esc(p.badge) + '</span>'
                : '';

            var stockAviso = (typeof p.stock === 'number' && p.stock <= 5 && p.stock > 0)
                ? '<small class="text-danger fw-bold d-block mb-2"><i class="ri-alarm-warning-line me-1"></i>¡Últimas ' + p.stock + ' unidades!</small>'
                : (p.stock === 0)
                ? '<small class="text-muted fw-bold d-block mb-2">Agotado</small>'
                : '';

            // p.image_url -> src de la imagen
            var imgUrl = p.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png';
            var desc = p.description || 'Producto de alto rendimiento Prana Fitness.';
            var agotado = (p.stock === 0);

            return [
                '<article class="col-lg-4 col-md-6 producto-item" data-categoria="' + esc(catClase) + '">',
                '  <div class="tarjeta-producto card h-100 border-0 shadow-sm rounded-3 overflow-hidden transition hover-shadow">',
                '    <div class="position-relative overflow-hidden bg-light" style="height: 300px;">',
                '      <img src="' + esc(imgUrl) + '" alt="' + esc(p.name) + '" class="w-100 h-100 object-fit-contain p-3" loading="lazy">',
                       badgeHtml,
                '    </div>',
                '    <div class="card-body">',
                '      <span class="badge bg-light text-success mb-2 d-inline-block">' + esc(catLabel) + '</span>',
                '      <h2 class="card-title h5 fw-bold">' + esc(p.name) + '</h2>',
                '      <p class="card-text text-muted small">' + esc(desc) + '</p>',
                       stockAviso,
                '      <h3 class="text-success fw-bold mb-3">' + formatoCOP(p.price) + ' <small class="text-muted fw-normal">COP</small></h3>',
                '      <div class="tarjeta-btns">',
                '        <button class="btn btn-success tarjeta-btns-carrito btn-carrito-principal"',
                '                data-accion="agregar-carrito"',
                '                data-producto-id="' + esc(p.id) + '"' + (agotado ? ' disabled' : '') + '>',
                '          <i class="ri-shopping-cart-line me-2"></i>' + (agotado ? 'Agotado' : 'Agregar al Carrito'),
                '        </button>',
                '        <button class="btn-fav' + (esFav ? ' activo' : '') + '"',
                '                data-accion="toggle-favorito"',
                '                data-producto-id="' + esc(p.id) + '"',
                '                aria-pressed="' + (esFav ? 'true' : 'false') + '"',
                '                aria-label="Guardar en favoritos: ' + esc(p.name) + '"',
                '                title="' + (esFav ? 'Quitar de favoritos' : 'Guardar en favoritos') + '">',
                '          <i class="' + (esFav ? 'ri-heart-fill' : 'ri-heart-line') + '" aria-hidden="true"></i>',
                '        </button>',
                '      </div>',
                '    </div>',
                '  </div>',
                '</article>'
            ].join('');
        }).join('');
    }

    // ── Delegación de eventos para Carrito y Favoritos (UUID dinámico) ───────
    function configurarDelegacionEventos() {
        var grid = document.getElementById('contenedor-productos') || document.querySelector('.productos-grid');
        if (!grid) return;

        grid.addEventListener('click', async function (e) {
            // ── 1. Acción: Agregar al Carrito ───────────────────────────────
            var btnCarrito = e.target.closest('[data-accion="agregar-carrito"]');
            if (btnCarrito) {
                e.preventDefault();
                var pid = btnCarrito.getAttribute('data-producto-id');
                var producto = _productosCargados.find(function (p) { return String(p.id) === String(pid); });
                if (!producto) return;

                if (typeof CarritoService !== 'undefined') {
                    CarritoService.agregar({
                        id:        producto.id,
                        nombre:    producto.name,
                        precio:    Number(producto.price) || 0,
                        imagen:    producto.image_url,
                        categoria: producto.category
                    });
                }

                // Animación de feedback en el botón
                var textoOriginal = btnCarrito.innerHTML;
                var clasesOriginales = btnCarrito.className;
                btnCarrito.disabled = true;
                btnCarrito.innerHTML = '<i class="ri-checkbox-circle-fill me-2"></i>¡Agregado!';
                btnCarrito.classList.add('btn-carrito--agregado');
                setTimeout(function () {
                    btnCarrito.disabled = false;
                    btnCarrito.innerHTML = textoOriginal;
                    btnCarrito.className = clasesOriginales;
                }, 1800);

                // Pulso visual en los contadores del carrito
                document.querySelectorAll('.contador-carrito').forEach(function (b) {
                    b.classList.remove('carrito-badge--pulso');
                    void b.offsetWidth;
                    b.classList.add('carrito-badge--pulso');
                });
                return;
            }

            // ── 2. Acción: Toggle Favorito (Directo a Supabase) ─────────────
            var btnFav = e.target.closest('[data-accion="toggle-favorito"]');
            if (btnFav) {
                e.preventDefault();
                var pidFav = btnFav.getAttribute('data-producto-id');
                var prodFav = _productosCargados.find(function (p) { return String(p.id) === String(pidFav); });
                if (!prodFav) return;

                var usuario = (typeof AuthService !== 'undefined') ? AuthService.getCurrentUser() : null;
                if (!usuario || !usuario.id) {
                    try { sessionStorage.setItem('prana_login_retorno', window.location.href); } catch (_) {}
                    _mostrarAviso('Debes iniciar sesión para guardar favoritos.');
                    setTimeout(function () {
                        window.location.href = '../login.html';
                    }, 1600);
                    return;
                }

                await toggleFavoritoSupabase(usuario.id, prodFav, btnFav);
                return;
            }
        });
    }

    // ── Toggle de favorito en Supabase ──────────────────────────────────────
    async function toggleFavoritoSupabase(uid, producto, boton) {
        if (!window.supabaseClient) {
            _mostrarAviso('Conexión con Supabase no disponible.', '#C0392B');
            return;
        }

        var index = _favoritosIds.indexOf(producto.id);
        var eraFavorito = index >= 0;
        var nuevoEstado = !eraFavorito;

        // Actualización optimista de UI
        if (nuevoEstado) {
            _favoritosIds.push(producto.id);
        } else {
            _favoritosIds.splice(index, 1);
        }
        actualizarBotonFavVisual(boton, nuevoEstado, true);

        try {
            if (nuevoEstado) {
                var { error: insertError } = await window.supabaseClient
                    .from('favorites')
                    .insert({ user_id: uid, product_id: producto.id });
                if (insertError) throw insertError;
                _mostrarAviso('❤️ ' + producto.name + ' guardado en favoritos.', '#6B0D25');
            } else {
                var { error: deleteError } = await window.supabaseClient
                    .from('favorites')
                    .delete()
                    .eq('user_id', uid)
                    .eq('product_id', producto.id);
                if (deleteError) throw deleteError;
                _mostrarAviso('💔 ' + producto.name + ' eliminado de favoritos.', '#6B6B6B');
            }
        } catch (err) {
            console.error('[Favoritos] Error al sincronizar con Supabase:', err);
            // Revertir estado optimista en caso de error
            if (nuevoEstado) {
                var idx = _favoritosIds.indexOf(producto.id);
                if (idx >= 0) _favoritosIds.splice(idx, 1);
            } else {
                _favoritosIds.push(producto.id);
            }
            actualizarBotonFavVisual(boton, eraFavorito, false);
            _mostrarAviso('No se pudo actualizar el favorito en Supabase.', '#C0392B');
        }
    }

    function actualizarBotonFavVisual(boton, activo, animar) {
        var icono = boton.querySelector('i');
        boton.classList.toggle('activo', activo);
        if (icono) {
            icono.className = activo ? 'ri-heart-fill' : 'ri-heart-line';
        }
        boton.setAttribute('aria-pressed', activo ? 'true' : 'false');
        boton.title = activo ? 'Quitar de favoritos' : 'Guardar en favoritos';

        if (animar) {
            boton.classList.remove('pulsando');
            void boton.offsetWidth;
            boton.classList.add('pulsando');
        }
    }

    // ── Configuración de filtros de categoría ───────────────────────────────
    function configurarFiltros() {
        var mapaFiltros = [
            { id: 'filtro-todos',        cat: 'todos' },
            { id: 'filtro-suplementos',  cat: 'suplementos' },
            { id: 'filtro-indumentaria', cat: 'indumentaria' },
            { id: 'filtro-accesorios',   cat: 'accesorios' },
            { id: 'filtro-equipamiento', cat: 'equipamiento' }
        ];

        mapaFiltros.forEach(function (f) {
            var input = document.getElementById(f.id);
            if (input) {
                input.addEventListener('change', function () {
                    if (input.checked) {
                        _categoriaActual = f.cat;
                        renderizarGrilla();
                    }
                });
            }
        });

        // Conectar también los labels superiores de las tarjetas de categoría
        document.querySelectorAll('.categoria-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var forAttr = card.getAttribute('for');
                if (forAttr) {
                    var inp = document.getElementById(forAttr);
                    if (inp) {
                        inp.checked = true;
                        var match = mapaFiltros.find(function (m) { return m.id === forAttr; });
                        if (match) {
                            _categoriaActual = match.cat;
                            renderizarGrilla();
                        }
                    }
                }
            });
        });
    }

    // ── Inicialización ───────────────────────────────────────────────────────
    function init() {
        if (typeof CarritoService !== 'undefined') {
            if (CarritoService.iniciar) CarritoService.iniciar();
        }

        configurarFiltros();
        configurarDelegacionEventos();

        // Esperar a que el cliente de Supabase esté listo
        if (window.supabaseClient) {
            cargarDatosSupabase();
        } else {
            mostrarCargando();
            window.addEventListener('supabase:ready', function handler() {
                window.removeEventListener('supabase:ready', handler);
                cargarDatosSupabase();
            });
        }

        // Reaccionar si los productos se actualizan desde el dashboard (tiempo real)
        window.addEventListener('prana:productos_actualizados', function () {
            cargarDatosSupabase();
        });

        // Reaccionar a cambios en la autenticación del usuario
        if (typeof AuthService !== 'undefined' && AuthService.onChange) {
            AuthService.onChange(function () {
                cargarDatosSupabase();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
