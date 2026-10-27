// js/pages/carrito.js
// Responsabilidad: lógica exclusiva de carrito.html.
// — Renderiza los ítems del carrito desde localStorage (CarritoService)
// — Gestiona controles de cantidad (incrementar, decrementar, input manual)
// — Gestiona eliminación de ítems y vaciado total
// — Calcula y muestra en tiempo real subtotal, envío y total
// — Gestiona la barra de progreso hacia envío gratis
// — GUARD DE SESIÓN: verifica AuthService antes de permitir el pago
// — Muestra modal de auth requerida si no hay sesión activa
// — Guarda intención de retorno al carrito para login.js
//
// Dependencias: utils/storage.js, utils/hash.js,
//               services/auth.js, components/carrito.js (cargados antes)

(function () {

    'use strict';

    // ── Formato de moneda (pesos colombianos) ────────────────────────────────
    function formatoCOP(valor) {
        return '$' + Math.round(valor).toLocaleString('es-CO') + ' COP';
    }

    // ── Escape básico de HTML para evitar XSS ───────────────────────────────
    function esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Generador de número de pedido simulado ───────────────────────────────
    function generarNumeroPedido() {
        var letras = 'PRANA';
        var nums   = Math.floor(Math.random() * 900000) + 100000;
        return letras + '-' + nums;
    }

    // ── Construye el mensaje de WhatsApp con los productos del carrito ───────
    function construirMensajeWA(items) {
        var lineas = ['Hola! Quiero confirmar mi pedido Prana:%0A'];
        items.forEach(function (item) {
            lineas.push(
                '• ' + esc(item.nombre) +
                ' x' + item.cantidad +
                ' — ' + formatoCOP(item.precio * item.cantidad) + '%0A'
            );
        });
        lineas.push('%0ATotal: ' + formatoCOP(CarritoService.obtenerTotal()));
        return lineas.join('');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RENDERIZADO
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Renderiza la lista de ítems del carrito o el estado vacío.
     */
    function renderizarLista() {
        var items        = CarritoService.obtenerItems();
        var contenedor   = document.getElementById('carr-items-contenedor');
        var contador     = document.getElementById('carr-contador-items');
        var btnVaciar    = document.getElementById('carr-btn-vaciar');

        if (!contenedor) return;

        // Actualizar contador
        var totalUnidades = CarritoService.obtenerCantidadTotal();
        if (contador) {
            contador.textContent =
                totalUnidades === 0 ? 'Carrito vacío' :
                totalUnidades === 1 ? '1 producto' :
                totalUnidades + ' productos';
        }

        // Mostrar/ocultar botón vaciar
        if (btnVaciar) {
            btnVaciar.style.display = items.length === 0 ? 'none' : 'inline-flex';
        }

        // Mostrar/ocultar footer de "Seguir comprando"
        var listaFooter = document.getElementById('carr-lista-footer');
        if (listaFooter) {
            listaFooter.style.display = items.length === 0 ? 'none' : 'block';
        }

        if (items.length === 0) {
            contenedor.innerHTML = _renderVacio();
            return;
        }

        // Renderizar ítems
        contenedor.innerHTML = items.map(function (item) {
            return _renderItem(item);
        }).join('');
    }

    /**
     * Retorna el HTML de un ítem del carrito.
     */
    function _renderItem(item) {
        var subtotal  = item.precio * item.cantidad;
        var imgSrc    = item.imagen
            ? 'src="' + esc(item.imagen) + '"'
            : 'src="https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png"';

        return [
            '<div class="carr-item" data-id="' + esc(item.id) + '" role="listitem">',

              '<div class="carr-item__img-wrap">',
                '<img ' + imgSrc + ' alt="' + esc(item.nombre) + '" class="carr-item__img" loading="lazy">',
              '</div>',

              '<div class="carr-item__info">',
                '<span class="carr-item__categoria">' + esc(item.categoria) + '</span>',
                '<p class="carr-item__nombre" title="' + esc(item.nombre) + '">' + esc(item.nombre) + '</p>',
                '<p class="carr-item__precio-unit">',
                  'Precio unit.: <strong>' + formatoCOP(item.precio) + '</strong>',
                '</p>',
              '</div>',

              '<div class="carr-item__controles">',
                '<span class="carr-item__subtotal" data-subtotal="' + esc(item.id) + '">' +
                    formatoCOP(subtotal) +
                '</span>',

                '<div class="carr-qty" role="group" aria-label="Cantidad de ' + esc(item.nombre) + '">',
                  '<button type="button" class="carr-qty__btn carr-qty__btn--menos"',
                          ' data-id="' + esc(item.id) + '"',
                          ' aria-label="Reducir cantidad"',
                          ' title="Reducir">',
                    '<i class="ri-subtract-line" aria-hidden="true"></i>',
                  '</button>',
                  '<input type="number"',
                         ' class="carr-qty__valor"',
                         ' value="' + item.cantidad + '"',
                         ' min="1" max="99"',
                         ' data-id="' + esc(item.id) + '"',
                         ' aria-label="Cantidad"',
                         ' inputmode="numeric">',
                  '<button type="button" class="carr-qty__btn carr-qty__btn--mas"',
                          ' data-id="' + esc(item.id) + '"',
                          ' aria-label="Aumentar cantidad"',
                          ' title="Aumentar">',
                    '<i class="ri-add-line" aria-hidden="true"></i>',
                  '</button>',
                '</div>',

                '<button type="button" class="carr-item__eliminar" data-id="' + esc(item.id) + '" aria-label="Eliminar ' + esc(item.nombre) + '">',
                  '<i class="ri-delete-bin-6-line" aria-hidden="true"></i>',
                  '<span>Quitar</span>',
                '</button>',
              '</div>',

            '</div>'
        ].join('');
    }

    /**
     * Retorna el HTML del estado vacío.
     */
    function _renderVacio() {
        return [
            '<div class="carr-vacio" role="status" aria-live="polite">',
              '<i class="ri-shopping-cart-line carr-vacio__icono" aria-hidden="true"></i>',
              '<h2 class="carr-vacio__titulo">Tu carrito está vacío</h2>',
              '<p class="carr-vacio__desc">',
                'Aún no has agregado productos. Explora nuestro catálogo y',
                '<br>encuentra todo lo que necesitas para tu entrenamiento.',
              '</p>',
              '<a href="paginas/productos.html" class="carr-btn-ir-tienda">',
                '<i class="ri-store-2-line" aria-hidden="true"></i>',
                'Ir al Catálogo',
              '</a>',
            '</div>'
        ].join('');
    }

    /**
     * Actualiza el panel de resumen sin volver a renderizar toda la lista.
     */
    function actualizarResumen() {
        var subtotal     = CarritoService.obtenerSubtotal();
        var costoEnvio   = CarritoService.obtenerCostoEnvio();
        var total        = CarritoService.obtenerTotal();
        var items        = CarritoService.obtenerItems();

        // Textos de resumen
        _setText('carr-subtotal',   formatoCOP(subtotal));
        _setText('carr-total',      formatoCOP(total));

        // Cantidad de ítems
        _setText('carr-num-items',
            items.length === 1 ? '1 producto' : items.length + ' productos');

        // Envío
        var envioEl    = document.getElementById('carr-envio');
        var envioWrap  = document.getElementById('carr-envio-wrap');

        if (envioEl) {
            envioEl.textContent = costoEnvio === 0
                ? '¡ENVÍO GRATIS! 🎉'
                : formatoCOP(costoEnvio);
        }
        if (envioWrap) {
            envioWrap.classList.toggle('carr-envio--gratis', costoEnvio === 0);
        }

        // Barra de progreso de envío gratis
        var umbral    = CarritoService.ENVIO_GRATIS_DESDE;
        var porcentaje= Math.min((subtotal / umbral) * 100, 100);
        var barraEl   = document.getElementById('carr-envio-barra');
        var textoEl   = document.getElementById('carr-envio-texto');

        if (barraEl) barraEl.style.width = porcentaje + '%';

        if (textoEl) {
            if (costoEnvio === 0) {
                textoEl.innerHTML =
                    '<strong>¡Felicitaciones!</strong> Tienes envío gratis en tu pedido.';
            } else {
                var faltante = umbral - subtotal;
                textoEl.innerHTML =
                    'Te faltan <strong>' + formatoCOP(faltante) + '</strong> para obtener envío gratis.';
            }
        }

        // Habilitar/deshabilitar botón de pago
        var btnPagar = document.getElementById('carr-btn-pagar');
        if (btnPagar) {
            btnPagar.disabled = items.length === 0;
        }
    }

    function _setText(id, texto) {
        var el = document.getElementById(id);
        if (el) el.textContent = texto;
    }

    /**
     * Actualiza el subtotal de un ítem específico sin rerenderizar todo.
     */
    function actualizarSubtotalItem(id) {
        var items = CarritoService.obtenerItems();
        var item  = items.find(function (i) { return i.id === id; });
        var el    = document.querySelector('[data-subtotal="' + id + '"]');
        if (item && el) {
            el.textContent = formatoCOP(item.precio * item.cantidad);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // EVENTOS
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Delegación de eventos sobre el contenedor de ítems.
     * Captura: − botón, + botón, input manual, quitar ítem.
     */
    function configurarEventosLista() {
        var contenedor = document.getElementById('carr-items-contenedor');
        if (!contenedor) return;

        contenedor.addEventListener('click', function (e) {

            // ── Botón MENOS ──────────────────────────────────────────────────
            var btnMenos = e.target.closest('.carr-qty__btn--menos');
            if (btnMenos) {
                var id  = btnMenos.getAttribute('data-id');
                var input = contenedor.querySelector('.carr-qty__valor[data-id="' + id + '"]');
                var qty   = parseInt(input ? input.value : 1, 10);
                var nueva = qty - 1;

                if (nueva <= 0) {
                    var itemsMenos = CarritoService.obtenerItems() || [];
                    var itemMenos = itemsMenos.find(function (it) { return String(it.id) === String(id); });
                    var nombreMenos = itemMenos ? itemMenos.nombre : 'Producto del carrito';


                    var precioMenos = itemMenos ? itemMenos.precio : 0;

                    if (typeof ModalConfirmacion !== 'undefined' && ModalConfirmacion.confirmarEliminacion) {
                        ModalConfirmacion.confirmarEliminacion({
                            titulo: 'Quitar producto del carrito',
                            nombre: nombreMenos,
                            identificador: id,
                            detalles: [
                                { etiqueta: 'Precio unitario', valor: '$' + Number(precioMenos).toLocaleString('es-CO') + ' COP' },
                                { etiqueta: 'Cantidad actual', valor: '1 unidad' }
                            ],
                            advertencia: 'Reducir la cantidad a cero quitará este producto de tu carrito de compras.',
                            onConfirmar: function () {
                                eliminarItemConAnimacion(id);
                            }
                        });
                    } else {
                        eliminarItemConAnimacion(id);
                    }
                } else {
                    if (input) input.value = nueva;
                    CarritoService.setCantidad(id, nueva);
                    actualizarSubtotalItem(id);
                    actualizarResumen();
                }
                return;
            }

            // ── Botón MÁS ────────────────────────────────────────────────────
            var btnMas = e.target.closest('.carr-qty__btn--mas');
            if (btnMas) {
                var id  = btnMas.getAttribute('data-id');
                var input = contenedor.querySelector('.carr-qty__valor[data-id="' + id + '"]');
                var qty   = parseInt(input ? input.value : 1, 10);
                var nueva = Math.min(qty + 1, 99);

                if (input) input.value = nueva;
                CarritoService.setCantidad(id, nueva);
                actualizarSubtotalItem(id);
                actualizarResumen();
                return;
            }

            // ── Botón ELIMINAR ───────────────────────────────────────────────
            var btnElim = e.target.closest('.carr-item__eliminar');
            if (btnElim) {
                var id = btnElim.getAttribute('data-id');
                var items = CarritoService.obtenerItems() || [];
                var item = items.find(function (it) { return String(it.id) === String(id); });
                var nombre = item ? item.nombre : 'Producto del carrito';
                var precio = item ? item.precio : 0;
                var cant = item ? item.cantidad : 1;

                if (typeof ModalConfirmacion !== 'undefined' && ModalConfirmacion.confirmarEliminacion) {
                    ModalConfirmacion.confirmarEliminacion({
                        titulo: 'Quitar producto del carrito',
                        nombre: nombre,
                        identificador: id,
                        detalles: [
                            { etiqueta: 'Precio unitario', valor: '$' + Number(precio).toLocaleString('es-CO') + ' COP' },
                            { etiqueta: 'Cantidad', valor: cant + ' unidad' + (cant !== 1 ? 'es' : '') },
                            { etiqueta: 'Subtotal del producto', valor: '$' + Number(precio * cant).toLocaleString('es-CO') + ' COP' }
                        ],
                        advertencia: '¿Deseas quitar este producto de tu carrito de compras?',
                        onConfirmar: function () {
                            eliminarItemConAnimacion(id);
                        }
                    });
                    return;
                }
                eliminarItemConAnimacion(id);
                return;
            }
        });

        // ── Input manual de cantidad ─────────────────────────────────────────
        contenedor.addEventListener('change', function (e) {
            if (!e.target.classList.contains('carr-qty__valor')) return;

            var id     = e.target.getAttribute('data-id');
            var nueva  = parseInt(e.target.value, 10);

            if (isNaN(nueva) || nueva < 1) {
                e.target.value = 1;
                nueva          = 1;
            } else if (nueva > 99) {
                e.target.value = 99;
                nueva          = 99;
            }

            CarritoService.setCantidad(id, nueva);
            actualizarSubtotalItem(id);
            actualizarResumen();
        });
    }

    /**
     * Elimina un ítem con animación de salida suave.
     */
    function eliminarItemConAnimacion(id) {
        var el = document.querySelector('.carr-item[data-id="' + id + '"]');

        if (el) {
            el.classList.add('carr-item--eliminando');
            setTimeout(function () {
                CarritoService.eliminar(id);
                renderizarLista();
                actualizarResumen();
            }, 300);
        } else {
            CarritoService.eliminar(id);
            renderizarLista();
            actualizarResumen();
        }
    }

    /**
     * Configura el botón "Vaciar carrito".
     */
    function configurarVaciar() {
        var btn = document.getElementById('carr-btn-vaciar');
        if (!btn) return;

        btn.addEventListener('click', function () {
            // Confirmar antes de vaciar
            var items = CarritoService.obtenerItems() || [];
            if (items.length === 0) return;

            var subtotal = CarritoService.obtenerSubtotal();
            var totalUnidades = CarritoService.obtenerCantidadTotal();

            var ejecutarVaciar = function () {
                CarritoService.vaciar();
    
                renderizarLista();
                actualizarResumen();
            };

            if (typeof ModalConfirmacion !== 'undefined' && ModalConfirmacion.confirmarEliminacion) {
                ModalConfirmacion.confirmarEliminacion({
                    titulo: 'Vaciar carrito de compras',
                    nombre: 'Todos los productos (' + items.length + ' ref.)',
                    identificador: 'CARRITO-COMPLETO',
                    detalles: [
                        { etiqueta: 'Total de artículos', valor: totalUnidades + ' unidades' },
                        { etiqueta: 'Subtotal acumulado', valor: '$' + Number(subtotal).toLocaleString('es-CO') + ' COP' }
                    ],
                    advertencia: '¿Estás seguro de que deseas vaciar completamente el carrito? Se eliminarán todos los artículos agregados.',
                    onConfirmar: ejecutarVaciar
                });
                return;
            }

            ejecutarVaciar();
            return;


            renderizarLista();
            actualizarResumen();
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GUARD DE SESIÓN
    // Verifica AuthService antes de permitir el flujo de pago.
    // Si no hay sesión: muestra el modal de autenticación requerida y guarda
    // la intención de retorno en sessionStorage para que login.js la lea.
    // ══════════════════════════════════════════════════════════════════════════

    /** Clave de sessionStorage donde se guarda la URL de retorno post-login */
    var KEY_RETORNO = 'prana_login_retorno';

    /**
     * Verifica si hay una sesión válida usando AuthService.
     * Fallback: lee directamente 'prana_sesion' de localStorage si AuthService
     * no está disponible (defensa en profundidad).
     * @returns {boolean}
     */
    function haySessionActiva() {
        // Preferir AuthService si está disponible (valida también expiración)
        if (typeof AuthService !== 'undefined') {
            return AuthService.estaAutenticado();
        }
        // Fallback directo a localStorage
        try {
            var raw = localStorage.getItem('prana_sesion');
            if (!raw) return false;
            var sesion = JSON.parse(raw);
            if (!sesion || !sesion.token || !sesion.usuario) return false;
            // Verificar expiración del token
            var partes = sesion.token.split('.');
            if (partes.length === 3) {
                var payload = JSON.parse(atob(partes[1]));
                if (payload.exp && payload.exp < Date.now()) return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Devuelve el nombre del usuario autenticado (o null).
     * @returns {string|null}
     */
    function obtenerNombreUsuario() {
        if (typeof AuthService !== 'undefined') {
            var u = AuthService.getCurrentUser();
            return u ? u.nombre : null;
        }
        try {
            var raw  = localStorage.getItem('prana_sesion');
            var data = raw ? JSON.parse(raw) : null;
            return (data && data.usuario && data.usuario.nombre) ? data.usuario.nombre : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Actualiza el pill de estado de sesión en el panel de resumen.
     * — Sesión activa: verde con nombre del usuario
     * — Sin sesión: vinotinto con invitación a ingresar
     */
    function actualizarPillSesion() {
        var pill   = document.getElementById('carr-sesion-pill');
        var texto  = document.getElementById('carr-sesion-texto');
        var icono  = pill ? pill.querySelector('i') : null;

        if (!pill) return;

        if (haySessionActiva()) {
            var nombre = obtenerNombreUsuario();
            pill.className  = 'carr-sesion-pill carr-sesion-pill--activa';
            if (icono)  icono.className = 'ri-user-smile-line';
            if (texto)  texto.textContent = nombre
                ? 'Hola, ' + nombre.split(' ')[0] + ' — Listo para pagar'
                : 'Sesión activa — Listo para pagar';
        } else {
            pill.className  = 'carr-sesion-pill carr-sesion-pill--inactiva';
            if (icono)  icono.className = 'ri-lock-line';
            if (texto)  texto.textContent = 'Inicia sesión para pagar';
        }
    }

    // ── Modal de autenticación requerida ────────────────────────────────────

    function abrirModalAuth() {
        var overlay = document.getElementById('carr-auth-overlay');
        if (!overlay) return;

        overlay.classList.add('carr-auth--visible');
        overlay.setAttribute('aria-hidden', 'false');

        // Guardar la URL de retorno para que login.js redirija de vuelta
        try {
            sessionStorage.setItem(KEY_RETORNO, window.location.href);
        } catch (e) { /* sessionStorage puede estar desactivado */ }

        // Construir URLs con parámetro de retorno para los botones del modal
        var retornoParam = encodeURIComponent(window.location.href);
        var btnLogin    = document.getElementById('carr-auth-btn-login');
        var btnRegistro = document.getElementById('carr-auth-btn-registro');

        if (btnLogin) {
            btnLogin.href = 'login.html?retorno=' + retornoParam;
        }
        if (btnRegistro) {
            btnRegistro.href = 'login.html?registro=1&retorno=' + retornoParam;
        }

        // Foco en el primer botón de acción (accesibilidad)
        if (btnLogin) {
            setTimeout(function () { btnLogin.focus(); }, 380);
        }
    }

    function cerrarModalAuth() {
        var overlay = document.getElementById('carr-auth-overlay');
        if (!overlay) return;
        overlay.classList.remove('carr-auth--visible');
        overlay.setAttribute('aria-hidden', 'true');

        // Restaurar foco al botón de pago
        var btnPagar = document.getElementById('carr-btn-pagar');
        if (btnPagar) setTimeout(function () { btnPagar.focus(); }, 350);
    }

    function configurarModalAuth() {
        // Botón cancelar
        var btnCancelar = document.getElementById('carr-auth-btn-cancelar');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', cerrarModalAuth);
        }

        // Cerrar al pulsar fuera del modal
        var overlay = document.getElementById('carr-auth-overlay');
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) cerrarModalAuth();
            });
        }

        // Cerrar con Escape (solo para este overlay; el modal de pago tiene el suyo)
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            var authOverlay = document.getElementById('carr-auth-overlay');
            if (authOverlay && authOverlay.classList.contains('carr-auth--visible')) {
                e.stopPropagation();
                cerrarModalAuth();
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MODAL DE CONFIRMACIÓN DE COMPRA (solo se alcanza si hay sesión activa)
    // ══════════════════════════════════════════════════════════════════════════

    function abrirModal(pedidoGenerado) {
        var overlay = document.getElementById('carr-modal-overlay');
        if (!overlay) return;

        // Llenar datos del modal con el pedido real
        var numeroPedido = pedidoGenerado ? pedidoGenerado.id : generarNumeroPedido();
        var numEl = document.getElementById('carr-modal-num-pedido');
        if (numEl) numEl.textContent = 'Pedido #' + numeroPedido;

        var totalEl = document.getElementById('carr-modal-total');
        if (totalEl) totalEl.textContent = formatoCOP(pedidoGenerado ? pedidoGenerado.total : CarritoService.obtenerTotal());

        // Construir enlace de WhatsApp
        var enlaceWA = document.getElementById('carr-modal-btn-wa');
        if (enlaceWA) {
            var items   = pedidoGenerado ? pedidoGenerado.items : CarritoService.obtenerItems();
            var mensaje = construirMensajeWA(items);
            enlaceWA.href = 'https://wa.me/573332359677?text=' + mensaje;
        }

        overlay.classList.add('carr-modal-overlay--visible');
        overlay.setAttribute('aria-hidden', 'false');

        // Foco dentro del modal para accesibilidad
        var btnPrincipal = document.getElementById('carr-modal-btn-inicio');
        if (btnPrincipal) {
            setTimeout(function () { btnPrincipal.focus(); }, 400);
        }
    }

    function cerrarModal() {
        var overlay = document.getElementById('carr-modal-overlay');
        if (!overlay) return;
        overlay.classList.remove('carr-modal-overlay--visible');
        overlay.setAttribute('aria-hidden', 'true');
    }

    function configurarModal() {
        // ── PUNTO DE CONTROL: Guard de sesión en el botón de pago ────────────
        // Esta es la única puerta de entrada al flujo de pago.
        // Si el carrito está vacío → no hace nada.
        // Si no hay sesión activa → abre el modal de autenticación requerida.
        // Si sí hay sesión → procede con el modal de confirmación de pedido.
        var btnPagar = document.getElementById('carr-btn-pagar');
        if (btnPagar) {
            btnPagar.addEventListener('click', async function () {
                var items = CarritoService.obtenerItems();
                // Guardia 1: carrito vacío
                if (items.length === 0) return;

                // Guardia 2: sin sesión activa → modal de auth
                if (!haySessionActiva()) {
                    abrirModalAuth();
                    return;
                }

                // Obtener usuario autenticado
                var usuario = null;
                if (typeof AuthService !== 'undefined') {
                    usuario = AuthService.getCurrentUser();
                }
                if (!usuario) {
                    try {
                        var ses = JSON.parse(localStorage.getItem('prana_sesion') || '{}');
                        usuario = ses.usuario || null;
                    } catch (e) {}
                }

                var uid = (usuario && usuario.id) ? usuario.id : 'usr_anon';
                var uNombre = (usuario && usuario.nombre) ? usuario.nombre : 'Cliente Prana';
                var uEmail = (usuario && usuario.email) ? usuario.email : '';
                var numPedido = generarNumeroPedido();
                var total = CarritoService.obtenerTotal();
                var costoEnvio = CarritoService.obtenerCostoEnvio();

                var itemsJson = items.map(function(i){
                    return {
                        id: i.id,
                        nombre: i.nombre,
                        precio: i.precio,
                        cantidad: i.cantidad,
                        imagen: i.imagen,
                        categoria: i.categoria
                    };
                });

                // Feedback visual en el botón de pago
                btnPagar.disabled = true;
                var htmlOriginal = btnPagar.innerHTML;
                btnPagar.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Registrando pedido...';

                var idPedidoGenerado = numPedido;

                // ── Inserción directa en la tabla 'orders' de Supabase ───────────
                try {
                    if (window.obtenerClienteSupabase) {
                        await window.obtenerClienteSupabase();
                    }

                    if (window.supabaseClient) {
                        var ordenPayload = {
                            user_id: uid,
                            items: itemsJson,
                            total: total,
                            status: 'pendiente'
                        };

                        // Compatibilidad total: intentar con total_amount y fallback a total según el esquema
                        var res = await window.supabaseClient.from('orders').insert({
                            ...ordenPayload,
                            total_amount: total
                        }).select();

                        if (res.error) {
                            res = await window.supabaseClient.from('orders').insert(ordenPayload).select();
                        }

                        if (!res.error && Array.isArray(res.data) && res.data[0]) {
                            idPedidoGenerado = res.data[0].id;
                        }
                    }
                } catch (eSupabase) {
                    console.error('[Carrito] Error al registrar orden en Supabase:', eSupabase);
                }

                // Crear objeto de pedido persistente para UI
                var nuevoPedido = {
                    id:            idPedidoGenerado,
                    userId:        uid,
                    clienteNombre: uNombre,
                    clienteEmail:  uEmail,
                    productos:     items.map(function(i){ return i.nombre + ' × ' + i.cantidad; }).join(' · '),
                    items:         itemsJson,
                    total:         total,
                    total_amount:  total,
                    costoEnvio:    costoEnvio,
                    estado:        'pendiente',
                    status:        'pendiente',
                    fecha:         new Date().toISOString(),
                    updatedAt:     new Date().toISOString()
                };

                // Guardar pedido en 'prana_orders' (caché local)
                try {
                    var rawOrders = localStorage.getItem('prana_orders');
                    var orders = rawOrders ? JSON.parse(rawOrders) : [];
                    if (!Array.isArray(orders)) orders = [];
                    orders.unshift(nuevoPedido);
                    localStorage.setItem('prana_orders', JSON.stringify(orders));
                } catch (e) {
                    console.error('[Carrito] Error al persistir orden en prana_orders:', e);
                }

                // Descontar stock del catálogo
                if (typeof ProductosStore !== 'undefined' && ProductosStore.descontarStock) {
                    ProductosStore.descontarStock(items);
                }

                btnPagar.disabled = false;
                btnPagar.innerHTML = htmlOriginal;

                // Sesión válida → continuar con la confirmación del pedido
                abrirModal(nuevoPedido);

                // Vaciar carrito al confirmar
                CarritoService.vaciar();
    
            });
        }

        // Botón "Ir al Inicio" dentro del modal de confirmación
        var btnInicio = document.getElementById('carr-modal-btn-inicio');
        if (btnInicio) {
            btnInicio.addEventListener('click', function () {
                cerrarModal();
                setTimeout(function () {
                    window.location.href = 'index.html';
                }, 400);
            });
        }

        // Cerrar modal de confirmación al hacer clic fuera
        var overlay = document.getElementById('carr-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) cerrarModal();
            });
        }

        // Escape solo cierra el modal de confirmación si no está abierto el de auth
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            var authOverlay = document.getElementById('carr-auth-overlay');
            var authAbierto = authOverlay && authOverlay.classList.contains('carr-auth--visible');
            if (!authAbierto) cerrarModal();
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // INICIALIZACIÓN
    // ══════════════════════════════════════════════════════════════════════════

    function init() {
        if (typeof CarritoService === 'undefined') {
            console.error('[Prana] CarritoService no está disponible. Verifica el orden de los scripts.');
            return;
        }

        // Sincronizar badge del header
        CarritoService.iniciar();

        // Renderizar lista y resumen inicial
        renderizarLista();
        actualizarResumen();

        // Pill de estado de sesión (muestra si el usuario está autenticado)
        actualizarPillSesion();

        // Eventos de la lista
        configurarEventosLista();

        // Botón vaciar
        configurarVaciar();

        // Modal de autenticación requerida (guard)
        configurarModalAuth();

        // Modal de confirmación de compra (post-guard)
        configurarModal();

        // Botón "Seguir comprando" (además del enlace en estado vacío)
        var btnSeguir = document.getElementById('carr-btn-seguir');
        if (btnSeguir) {
            btnSeguir.addEventListener('click', function (e) {
                e.preventDefault();
                window.location.href = 'paginas/productos.html';
            });
        }

        // Escuchar cambios del carrito desde otras pestañas (storage event)
        window.addEventListener('storage', function (e) {
            if (e.key === 'prana_carrito') {
                renderizarLista();
                actualizarResumen();
            }
            // Si la sesión cambia en otra pestaña, actualizar el pill
            if (e.key === 'prana_sesion') {
                actualizarPillSesion();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
