// js/pages/index.js
// Responsabilidad: lógica exclusiva de index.html (página de inicio).
// — Consulta dinámica a Supabase: window.supabaseClient.from('products').select('*').limit(3)
// — Renderizado dinámico de productos destacados utilizando UUIDs
// — Delegación de eventos para "Agregar al Carrito" y "Favoritos"
// — Gestión de favoritos 100% en Supabase sin dependencias de localStorage
//
// Dependencias: services/supabaseClient.js, services/auth.js,
//               services/productos-store.js, components/carrito.js

(function () {

    'use strict';

    var _productosDestacados = [];
    var _favoritosIds        = [];

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

    function mostrarCargando() {
        var contenedor = document.getElementById('contenedor-productos-destacados');
        if (!contenedor) return;
        contenedor.innerHTML = [
            '<div class="col-12 text-center py-5">',
            '  <div class="spinner-border text-success mb-3" role="status" style="width: 2.5rem; height: 2.5rem;">',
            '    <span class="visually-hidden">Cargando destacados...</span>',
            '  </div>',
            '  <p class="text-muted fw-semibold">Cargando productos destacados...</p>',
            '</div>'
        ].join('');
    }

    async function cargarProductosDestacados() {
        var contenedor = document.getElementById('contenedor-productos-destacados');
        if (!contenedor) return;

        if (!window.supabaseClient) {
            console.warn('[Index] supabaseClient aún no disponible.');
            return;
        }

        mostrarCargando();

        try {
            // Consulta de los primeros 3 productos desde Supabase
            var { data, error } = await window.supabaseClient
                .from('products')
                .select('*')
                .limit(3);

            if (error) {
                console.error('[Index] Error de Supabase al consultar destacados:', error);
                contenedor.innerHTML = '<div class="col-12 text-center text-muted py-4"><p>No fue posible cargar los productos destacados en este momento.</p></div>';
                return;
            }

            _productosDestacados = Array.isArray(data) ? data : [];

            // Cargar favoritos del usuario autenticado si existe sesión
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
                    _favoritosIds = [];
                }
            } else {
                _favoritosIds = [];
            }

            renderizarDestacados();

        } catch (e) {
            console.error('[Index] Excepción al cargar productos destacados:', e);
            contenedor.innerHTML = '<div class="col-12 text-center text-muted py-4"><p>Error al conectar con la base de datos.</p></div>';
        }
    }

    function renderizarDestacados() {
        var contenedor = document.getElementById('contenedor-productos-destacados');
        if (!contenedor) return;

        if (_productosDestacados.length === 0) {
            contenedor.innerHTML = '<div class="col-12 text-center text-muted py-4"><p>Pronto añadiremos productos destacados.</p></div>';
            return;
        }

        contenedor.innerHTML = _productosDestacados.map(function (p) {
            var esFav = _favoritosIds.indexOf(p.id) >= 0;
            var catLabel = p.category ? (p.category.charAt(0).toUpperCase() + p.category.slice(1)) : 'Fitness';
            var catClase = (p.category || '').toLowerCase().replace(/[^a-z0-9]/g, '');

            var badgeHtml = (p.badge && String(p.badge).trim())
                ? '<span class="badge position-absolute top-3 start-3" style="background: linear-gradient(135deg, #3D0712 0%, #5C0A1B 50%, #7A1429 100%) !important; color: #FFFFFF !important; border: 1px solid rgba(192,192,192,0.18); z-index:2;">' + esc(p.badge) + '</span>'
                : '';

            var imgUrl = p.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png';
            var desc = p.description || 'Producto de alto rendimiento Prana Fitness.';
            var agotado = (p.stock === 0);

            return [
                '<article class="col-lg-4 col-md-6" data-categoria="' + esc(catClase) + '">',
                '  <div class="tarjeta-producto card h-100 border-0 shadow-sm rounded-3 overflow-hidden position-relative hover-shadow transition" style="background-color: #FFFFFF !important;">',
                '    <div class="position-relative overflow-hidden" style="height: 300px; background: linear-gradient(135deg, #F5F5F5 0%, #E0E0E0 100%) !important;">',
                '      <img src="' + esc(imgUrl) + '" alt="' + esc(p.name) + '" class="w-100 h-100 object-fit-contain p-3" loading="lazy">',
                       badgeHtml,
                '    </div>',
                '    <div class="card-body d-flex flex-column" style="background-color: #FFFFFF !important;">',
                '      <span class="badge mb-2 d-inline-block align-self-start" style="background: linear-gradient(135deg, rgba(92,10,27,0.10) 0%, rgba(122,20,41,0.08) 100%) !important; color: #5C0A1B !important; border: 1px solid rgba(92,10,27,0.18);">' + esc(catLabel) + '</span>',
                '      <h3 class="card-title h5 fw-bold" style="color: #3D0712 !important;">' + esc(p.name) + '</h3>',
                '      <p class="card-text small flex-grow-1" style="color: #2C2C2C !important;">' + esc(desc) + '</p>',
                '      <div class="d-flex justify-content-between align-items-center mb-3">',
                '        <h4 class="mb-0 fw-bold" style="color: #5C0A1B !important;">' + formatoCOP(p.price) + '</h4>',
                '        <small style="color: #8A8A8A !important;">COP</small>',
                '      </div>',
                '      <div class="tarjeta-btns d-flex gap-2 align-items-center">',
                '        <button class="btn btn-success tarjeta-btns-carrito btn-carrito-principal flex-grow-1"',
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

    function configurarDelegacionEventos() {
        var contenedor = document.getElementById('contenedor-productos-destacados');
        if (!contenedor) return;

        contenedor.addEventListener('click', async function (e) {
            // ── 1. Acción: Agregar al Carrito ──
            var btnCarrito = e.target.closest('[data-accion="agregar-carrito"]');
            if (btnCarrito) {
                e.preventDefault();
                var pid = btnCarrito.getAttribute('data-producto-id');
                var producto = _productosDestacados.find(function (p) { return String(p.id) === String(pid); });
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

                // Pulso en los contadores del header
                document.querySelectorAll('.contador-carrito').forEach(function (b) {
                    b.classList.remove('carrito-badge--pulso');
                    void b.offsetWidth;
                    b.classList.add('carrito-badge--pulso');
                });
                return;
            }

            // ── 2. Acción: Toggle Favoritos ──
            var btnFav = e.target.closest('[data-accion="toggle-favorito"]');
            if (btnFav) {
                e.preventDefault();
                var pidFav = btnFav.getAttribute('data-producto-id');
                var prodFav = _productosDestacados.find(function (p) { return String(p.id) === String(pidFav); });
                if (!prodFav) return;

                var usuario = (typeof AuthService !== 'undefined') ? AuthService.getCurrentUser() : null;
                if (!usuario || !usuario.id) {
                    try { sessionStorage.setItem('prana_login_retorno', window.location.href); } catch (_) {}
                    _mostrarAviso('Debes iniciar sesión para guardar favoritos.');
                    setTimeout(function () {
                        window.location.href = 'login.html';
                    }, 1600);
                    return;
                }

                await toggleFavoritoSupabase(usuario.id, prodFav, btnFav);
                return;
            }
        });
    }

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

    function init() {
        configurarDelegacionEventos();

        if (window.supabaseClient) {
            cargarProductosDestacados();
        } else {
            mostrarCargando();
            window.addEventListener('supabase:ready', function onReady() {
                window.removeEventListener('supabase:ready', onReady);
                cargarProductosDestacados();
            });
        }

        window.addEventListener('prana:productos_actualizados', function () {
            cargarProductosDestacados();
        });

        if (typeof AuthService !== 'undefined' && AuthService.onChange) {
            AuthService.onChange(function () {
                cargarProductosDestacados();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
