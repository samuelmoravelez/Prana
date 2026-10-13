/**
 * js/pages/dashboard.js
 * Panel de Control Prana Fitness — Doble Rol (Admin / Cliente)
 *
 * Arquitectura de módulos:
 *   Dashboard        — Orquestador principal, guard de sesión, rutas
 *   DStore           — Capa de datos (localStorage CRUD)
 *   DRender          — Funciones de renderizado HTML
 *   DCharts          — Gráficos SVG (barras + donut)
 *   DToast           — Sistema de notificaciones
 *   DSidebar         — Lógica del sidebar colapsable
 *
 * Claves de localStorage utilizadas:
 *   prana_sesion      (AuthService)   — sesión activa
 *   prana_usuarios    (AuthService)   — usuarios registrados
 *   prana_orders      — pedidos
 *   prana_services    — solicitudes de servicios
 *   prana_blog_posts  — artículos del blog
 *   prana_messages    — mensajes del formulario de contacto
 *   prana_perfil_{id} — perfil extendido del cliente
 *   prana_favoritos_{id} — favoritos del cliente
 *
 * Dependencias: utils/storage.js, utils/hash.js, services/auth.js
 */

// ═══════════════════════════════════════════════════════════════════════════
// DSTORE — Capa de datos sobre localStorage
// ═══════════════════════════════════════════════════════════════════════════
var DStore = (function () {

    'use strict';

    var KEYS = {
        pedidos:    'prana_orders',
        servicios:  'prana_services',
        blog:       'prana_blog_posts',
        mensajes:   'prana_messages',
        usuarios:   'prana_usuarios'
    };

    function _get(clave) {
        try {
            var raw = localStorage.getItem(clave);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function _set(clave, valor) {
        try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {}
    }

    // ── PEDIDOS ──────────────────────────────────────────────────────────────
    function getPedidos()            { return _get(KEYS.pedidos)  || []; }
    function setPedidos(p)           { _set(KEYS.pedidos, p); }

    function getPedidosDeUsuario(uid) {
        return getPedidos().filter(function(p) { return p.userId === uid; });
    }

    function actualizarEstadoPedido(id, estado) {
        var lista = getPedidos();
        var idx   = lista.findIndex(function(p) { return p.id === id; });
        if (idx >= 0) { lista[idx].estado = estado; lista[idx].updatedAt = new Date().toISOString(); }
        setPedidos(lista);
    }

    // ── SERVICIOS ────────────────────────────────────────────────────────────
    function getServicios()          { return _get(KEYS.servicios) || []; }
    function setServicios(s)         { _set(KEYS.servicios, s); }

    function getServiciosDeUsuario(uid) {
        return getServicios().filter(function(s) { return s.userId === uid; });
    }

    function actualizarEstadoServicio(id, estado) {
        var lista = getServicios();
        var idx   = lista.findIndex(function(s) { return s.id === id; });
        if (idx >= 0) { lista[idx].estado = estado; }
        setServicios(lista);
    }

    // ── BLOG ─────────────────────────────────────────────────────────────────
    function getBlog()               { return _get(KEYS.blog)     || []; }
    function setBlog(b)              { _set(KEYS.blog, b); }

    function crearPost(datos) {
        var lista = getBlog();
        var post  = {
            id:        'post_' + Date.now(),
            titulo:    datos.titulo.trim(),
            categoria: datos.categoria,
            extracto:  datos.extracto.trim(),
            autor:     datos.autor || 'Admin Prana',
            fecha:     new Date().toISOString(),
            publicado: true
        };
        lista.unshift(post);
        setBlog(lista);
        return post;
    }

    function actualizarPost(id, datos) {
        var lista = getBlog();
        var idx   = lista.findIndex(function(p) { return p.id === id; });
        if (idx >= 0) {
            lista[idx].titulo    = datos.titulo.trim();
            lista[idx].categoria = datos.categoria;
            lista[idx].extracto  = datos.extracto.trim();
            lista[idx].editadoEn = new Date().toISOString();
        }
        setBlog(lista);
    }

    function eliminarPost(id) {
        setBlog(getBlog().filter(function(p) { return p.id !== id; }));
    }

    // ── MENSAJES ─────────────────────────────────────────────────────────────
    function getMensajes()          { return _get(KEYS.mensajes)  || []; }
    function setMensajes(m)         { _set(KEYS.mensajes, m); }

    function marcarMensajeLeido(id) {
        var lista = getMensajes();
        var idx   = lista.findIndex(function(m) { return m.id === id; });
        if (idx >= 0) lista[idx].leido = true;
        setMensajes(lista);
    }

    function marcarTodosLeidos() {
        setMensajes(getMensajes().map(function(m) { m.leido = true; return m; }));
    }

    // ── GESTIÓN DE USUARIOS (solo admin) ─────────────────────────────────────
    function getUsuarios() {
        return _get(KEYS.usuarios) || [];
    }

    /**
     * Actualiza nombre, email y/o role de un usuario en prana_usuarios.
     * Si se proporciona nuevoHash+nuevoSalt, actualiza la contraseña también.
     * @param {string} uid
     * @param {Object} cambios - { nombre?, email?, role?, hash?, salt? }
     */
    function actualizarUsuario(uid, cambios) {
        var usuarios = getUsuarios();
        var idx      = usuarios.findIndex(function (u) { return u.id === uid; });
        if (idx < 0) return false;

        // Campos seguros de actualizar directamente
        if (typeof cambios.nombre === 'string' && cambios.nombre.trim()) {
            usuarios[idx].nombre = cambios.nombre.trim();
        }
        if (typeof cambios.email === 'string' && cambios.email.trim()) {
            usuarios[idx].email = cambios.email.trim().toLowerCase();
        }
        if (cambios.role === 'admin' || cambios.role === 'cliente') {
            usuarios[idx].role = cambios.role;
        }
        // Hash + salt solo se tocan si se proporcionan ambos
        if (cambios.hash && cambios.salt) {
            usuarios[idx].hash = cambios.hash;
            usuarios[idx].salt = cambios.salt;
        }

        _set(KEYS.usuarios, usuarios);
        return true;
    }

    /**
     * Elimina un usuario por id.
     * Protección: no permite eliminar al admin de sistema ni al usuario activo.
     */
    function eliminarUsuario(uid, uidActivo) {
        if (uid === 'usr_admin_prana_default') return false; // protegido
        if (uid === uidActivo) return false;                  // no suicidio
        _set(KEYS.usuarios, getUsuarios().filter(function (u) { return u.id !== uid; }));
        return true;
    }

    // ── PERFIL EXTENDIDO ─────────────────────────────────────────────────────
    function getPerfil(uid) {
        return _get('prana_perfil_' + uid) || {};
    }

    function setPerfil(uid, datos) {
        var actual = getPerfil(uid);
        _set('prana_perfil_' + uid, Object.assign({}, actual, datos));
    }

    // ── FAVORITOS ────────────────────────────────────────────────────────────
    function getFavoritos(uid)       { return _get('prana_favoritos_' + uid) || []; }
    function setFavoritos(uid, list) { _set('prana_favoritos_' + uid, list); }

    function toggleFavorito(uid, item) {
        var list = getFavoritos(uid);
        var idx  = list.findIndex(function(f) { return f.id === item.id; });
        if (idx >= 0) { list.splice(idx, 1); }
        else          { list.unshift(item); }
        setFavoritos(uid, list);
        return idx < 0; // true = agregado, false = quitado
    }

    // ── SEED DE DATOS DEMO ───────────────────────────────────────────────────
    function sembrarDemoSiVacio(usuario) {
        var uid = usuario.id;

        // Pedidos demo
        if (getPedidos().length === 0) {
            setPedidos([
                {
                    id: 'PED-001', userId: uid, clienteNombre: usuario.nombre,
                    productos: 'Whey Protein 2kg × 1 · Shaker Pro 700ml × 2',
                    total: 253000, estado: 'completado',
                    fecha: _fechaRelativa(-5), updatedAt: _fechaRelativa(-3)
                },
                {
                    id: 'PED-002', userId: uid, clienteNombre: usuario.nombre,
                    productos: 'Creatina 500g × 1 · Bandas Elásticas Set × 1',
                    total: 140000, estado: 'enviado',
                    fecha: _fechaRelativa(-2), updatedAt: _fechaRelativa(-1)
                },
                {
                    id: 'PED-003', userId: uid, clienteNombre: 'Laura Martínez',
                    productos: 'Sneakers Training Pro × 1',
                    total: 260000, estado: 'proceso',
                    fecha: _fechaRelativa(-1), updatedAt: _fechaRelativa(0)
                },
                {
                    id: 'PED-004', userId: 'other_user', clienteNombre: 'Carlos Gómez',
                    productos: 'Mancuernas 20kg (par) × 1',
                    total: 489000, estado: 'pendiente',
                    fecha: _fechaRelativa(0), updatedAt: _fechaRelativa(0)
                }
            ]);
        }

        // Servicios demo
        if (getServicios().length === 0) {
            setServicios([
                {
                    id: 'SRV-001', userId: uid, clienteNombre: usuario.nombre,
                    tipo: 'Plan de Entrenamiento', duracion: '3 meses',
                    coach: 'Coach Miguel Torres', estado: 'activo',
                    fecha: _fechaRelativa(-10), inicio: _fechaRelativa(-10)
                },
                {
                    id: 'SRV-002', userId: 'other_user', clienteNombre: 'Diana Restrepo',
                    tipo: 'Asesoría Nutricional', duracion: '1 mes',
                    coach: 'Nut. Ana Giraldo', estado: 'pendiente',
                    fecha: _fechaRelativa(-1), inicio: null
                },
                {
                    id: 'SRV-003', userId: 'other_user', clienteNombre: 'Sebastián Vargas',
                    tipo: 'Reserva Showroom', duracion: '1 sesión',
                    coach: 'Tienda Prana', estado: 'completado',
                    fecha: _fechaRelativa(-7), inicio: _fechaRelativa(-7)
                }
            ]);
        }

        // Blog demo
        if (getBlog().length === 0) {
            setBlog([
                {
                    id: 'post_demo_1', titulo: '5 Tips de Nutrición para Maximizar tu Rendimiento',
                    categoria: 'Nutrición', extracto: 'Descubre cómo la nutrición pre y post entrenamiento puede transformar tus resultados fitness.',
                    autor: 'Admin Prana', fecha: _fechaRelativa(-8), publicado: true
                },
                {
                    id: 'post_demo_2', titulo: 'Guía Completa: Cómo Tomar Creatina Correctamente',
                    categoria: 'Suplementos', extracto: 'La creatina es el suplemento más estudiado del mundo. Aprende la dosis, el timing y los ciclos ideales.',
                    autor: 'Admin Prana', fecha: _fechaRelativa(-3), publicado: true
                },
                {
                    id: 'post_demo_3', titulo: 'Rutina Full Body para Entrenar en Casa con Mancuernas',
                    categoria: 'Entrenamiento', extracto: 'No necesitas gimnasio. Con un par de mancuernas ajustables puedes lograr un cuerpo de alto rendimiento.',
                    autor: 'Admin Prana', fecha: _fechaRelativa(-1), publicado: true
                }
            ]);
        }

        // Mensajes demo
        if (getMensajes().length === 0) {
            setMensajes([
                {
                    id: 'msg_001', nombre: 'Andrés Pérez', email: 'andres@gmail.com',
                    asunto: '¿Tienen proteína sin lactosa?',
                    mensaje: 'Hola! Quisiera saber si manejan opciones de proteína sin lactosa para personas con intolerancia.',
                    fecha: _fechaRelativa(-1), leido: false
                },
                {
                    id: 'msg_002', nombre: 'Valentina Ríos', email: 'vale.rios@hotmail.com',
                    asunto: 'Consulta sobre envíos a Bogotá',
                    mensaje: 'Buenos días, me gustaría saber los tiempos de envío a Bogotá y el costo de despacho.',
                    fecha: _fechaRelativa(-2), leido: false
                },
                {
                    id: 'msg_003', nombre: 'Diego Castaño', email: 'diego.c@outlook.com',
                    asunto: 'Interesado en plan de entrenamiento',
                    mensaje: 'Quiero info sobre el plan de entrenamiento personalizado de 3 meses. ¿Incluye rutina y dieta?',
                    fecha: _fechaRelativa(-3), leido: true
                },
                {
                    id: 'msg_004', nombre: 'Paola Hernández', email: 'pao.hdz@gmail.com',
                    asunto: 'Solicitud de devolución pedido PED-001',
                    mensaje: 'Buenas tardes, necesito hacer una devolución de mi último pedido. El shaker llegó defectuoso.',
                    fecha: _fechaRelativa(-4), leido: true
                }
            ]);
        }

        // Favoritos demo
        if (getFavoritos(uid).length === 0) {
            setFavoritos(uid, [
                {
                    id: 'whey-protein-2kg', tipo: 'producto', nombre: 'Whey Protein Premium 2kg',
                    precio: 189000, categoria: 'Suplementos',
                    imagen: 'https://res.cloudinary.com/atexcbli/image/upload/v1791239384/1111111.png'
                },
                {
                    id: 'sneakers-training-pro', tipo: 'producto', nombre: 'Sneakers Training Pro',
                    precio: 260000, categoria: 'Indumentaria',
                    imagen: 'https://res.cloudinary.com/atexcbli/image/upload/v1791237492/33.png'
                },
                {
                    id: 'post_demo_1', tipo: 'blog', nombre: '5 Tips de Nutrición para Maximizar tu Rendimiento',
                    precio: null, categoria: 'Artículo · Blog',
                    imagen: null
                }
            ]);
        }
    }

    function _fechaRelativa(diasOffset) {
        var d = new Date();
        d.setDate(d.getDate() + diasOffset);
        return d.toISOString();
    }

    return {
        // Pedidos
        getPedidos, setPedidos, getPedidosDeUsuario, actualizarEstadoPedido,
        // Servicios
        getServicios, setServicios, getServiciosDeUsuario, actualizarEstadoServicio,
        // Blog
        getBlog, setBlog, crearPost, actualizarPost, eliminarPost,
        // Mensajes
        getMensajes, setMensajes, marcarMensajeLeido, marcarTodosLeidos,
        // Perfil y favoritos
        getPerfil, setPerfil, getFavoritos, setFavoritos, toggleFavorito,
        // Usuarios (admin)
        getUsuarios, actualizarUsuario, eliminarUsuario,
        // Seed
        sembrarDemoSiVacio
    };

})();


// ═══════════════════════════════════════════════════════════════════════════
// DTOAST — Sistema de notificaciones
// ═══════════════════════════════════════════════════════════════════════════
var DToast = (function () {

    'use strict';

    var ICONOS = { ok: 'ri-checkbox-circle-fill', error: 'ri-error-warning-fill', info: 'ri-information-fill' };

    function mostrar(mensaje, tipo, duracion) {
        tipo     = tipo     || 'ok';
        duracion = duracion || 3000;

        var wrap  = document.getElementById('d-toast-wrap');
        if (!wrap) return;

        var toast = document.createElement('div');
        toast.className = 'd-toast d-toast--' + tipo;
        toast.setAttribute('role', 'alert');
        toast.innerHTML =
            '<i class="' + (ICONOS[tipo] || ICONOS.info) + ' d-toast__icon" aria-hidden="true"></i>' +
            '<span>' + _esc(mensaje) + '</span>';

        wrap.appendChild(toast);

        setTimeout(function () {
            toast.classList.add('saliendo');
            setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
        }, duracion);
    }

    function ok(msg)    { mostrar(msg, 'ok'); }
    function error(msg) { mostrar(msg, 'error'); }
    function info(msg)  { mostrar(msg, 'info', 4000); }

    function _esc(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    return { mostrar, ok, error, info };

})();


// ═══════════════════════════════════════════════════════════════════════════
// DCHARTS — Gráficos SVG
// ═══════════════════════════════════════════════════════════════════════════
var DCharts = (function () {

    'use strict';

    var PALETA_BARRAS = ['#5C0A1B','#7A1429','#9A1F38','#B82847','#C84E5E','#D87A85','#8A8A8A','#C0C0C0','#E0E0E0','#F0F0F0','#3B82F6','#10B981'];
    var PALETA_DONUT  = ['#5C0A1B','#7A1429','#3B82F6','#10B981','#F59E0B'];

    /**
     * Renderiza un gráfico de barras verticales en un SVG.
     * @param {string} svgId - ID del elemento SVG
     * @param {Array}  datos  - [{ label, valor }]
     */
    function renderBarras(svgId, datos) {
        var svg = document.getElementById(svgId);
        if (!svg || !datos.length) return;

        var W = 560, H = 200;
        var paddingL = 40, paddingR = 10, paddingT = 20, paddingB = 36;
        var areaW    = W - paddingL - paddingR;
        var areaH    = H - paddingT - paddingB;
        var maxVal   = Math.max.apply(null, datos.map(function(d) { return d.valor; })) || 1;
        var barW     = Math.floor(areaW / datos.length * 0.6);
        var gap      = Math.floor(areaW / datos.length);

        var lineas   = '';
        var NUM_LINEAS = 4;
        for (var l = 0; l <= NUM_LINEAS; l++) {
            var y = paddingT + (areaH / NUM_LINEAS) * l;
            var v = Math.round(maxVal * (1 - l / NUM_LINEAS));
            lineas +=
                '<line x1="' + paddingL + '" y1="' + y + '" x2="' + (W - paddingR) + '" y2="' + y +
                '" stroke="#E2E4E8" stroke-width="1" stroke-dasharray="4 3"/>' +
                '<text x="' + (paddingL - 4) + '" y="' + (y + 4) + '"' +
                ' text-anchor="end" font-size="7" fill="#8A8AA0">' +
                (v >= 1000000 ? (v/1000000).toFixed(1) + 'M' : v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) +
                '</text>';
        }

        var barras = '';
        datos.forEach(function (d, i) {
            var x  = paddingL + gap * i + (gap - barW) / 2;
            var bh = Math.max(4, (d.valor / maxVal) * areaH);
            var y  = paddingT + areaH - bh;
            var color = PALETA_BARRAS[i % PALETA_BARRAS.length];
            barras +=
                '<g class="d-chart-bar-wrap">' +
                '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + bh +
                '" rx="4" ry="4" fill="' + color + '" class="d-chart-bar-fill"/>' +
                '<text x="' + (x + barW / 2) + '" y="' + (y - 5) + '" class="d-chart-val">' +
                (d.valor >= 1000000 ? '$' + (d.valor/1000000).toFixed(1)+'M' :
                 d.valor >= 1000    ? '$' + (d.valor/1000).toFixed(0)+'k'    : d.valor) +
                '</text>' +
                '<text x="' + (x + barW / 2) + '" y="' + (paddingT + areaH + 14) + '" class="d-chart-label">' +
                _esc(d.label) + '</text>' +
                '</g>';
        });

        svg.innerHTML =
            '<line x1="' + paddingL + '" y1="' + paddingT + '" x2="' + paddingL + '" y2="' + (paddingT + areaH) +
            '" stroke="#E2E4E8" stroke-width="1.5"/>' +
            '<line x1="' + paddingL + '" y1="' + (paddingT + areaH) + '" x2="' + (W - paddingR) + '" y2="' + (paddingT + areaH) +
            '" stroke="#E2E4E8" stroke-width="1.5" class="d-chart-baseline"/>' +
            lineas + barras;
    }

    /**
     * Renderiza un gráfico de donut SVG con leyenda.
     * @param {string} wrapperId - ID del div contenedor
     * @param {Array}  segmentos - [{ label, valor, pct }]
     */
    function renderDonut(wrapperId, segmentos) {
        var wrap = document.getElementById(wrapperId);
        if (!wrap || !segmentos.length) return;

        var total = segmentos.reduce(function(a, s) { return a + s.valor; }, 0) || 1;
        var R = 60, CX = 70, CY = 70, strokeW = 28;
        var perim = 2 * Math.PI * R;

        var arcos    = '';
        var acumPct  = 0;
        segmentos.forEach(function (seg, i) {
            var pct    = seg.valor / total;
            var offset = perim * (1 - acumPct);
            var dash   = perim * pct;
            arcos +=
                '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '"' +
                ' fill="none"' +
                ' stroke="' + PALETA_DONUT[i % PALETA_DONUT.length] + '"' +
                ' stroke-width="' + strokeW + '"' +
                ' stroke-dasharray="' + dash + ' ' + (perim - dash) + '"' +
                ' stroke-dashoffset="' + offset + '"' +
                ' transform="rotate(-90 ' + CX + ' ' + CY + ')"/>';
            acumPct += pct;
        });

        var svgHtml =
            '<svg class="d-donut-svg" width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">' +
            '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="none" stroke="#F4F5F7" stroke-width="' + strokeW + '"/>' +
            arcos +
            '<text x="' + CX + '" y="' + (CY + 5) + '" text-anchor="middle" font-size="14" font-weight="800" fill="#1A1A2E">' +
            total + '</text>' +
            '<text x="' + CX + '" y="' + (CY + 20) + '" text-anchor="middle" font-size="8" fill="#8A8AA0">pedidos</text>' +
            '</svg>';

        var leyendaHtml = '<div class="d-donut-legend">';
        segmentos.forEach(function (seg, i) {
            var pctMostrado = ((seg.valor / total) * 100).toFixed(0) + '%';
            leyendaHtml +=
                '<div class="d-donut-legend__item">' +
                '<span class="d-donut-legend__dot" style="background:' + PALETA_DONUT[i % PALETA_DONUT.length] + '"></span>' +
                '<span class="d-donut-legend__label">' + _esc(seg.label) + '</span>' +
                '<span class="d-donut-legend__pct">' + pctMostrado + '</span>' +
                '</div>';
        });
        leyendaHtml += '</div>';

        wrap.innerHTML = svgHtml + leyendaHtml;
    }

    function _esc(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    return { renderBarras, renderDonut };

})();


// ═══════════════════════════════════════════════════════════════════════════
// DSIDEBAR — Sidebar colapsable y navegación
// ═══════════════════════════════════════════════════════════════════════════
var DSidebar = (function () {

    'use strict';

    var _colapsado = false;

    /* Menús por rol */
    var MENU_ADMIN = [
        { id: 'sec-admin-resumen',   icon: 'ri-dashboard-line',      label: 'Resumen',          seccion: 'admin' },
        { id: 'sec-admin-pedidos',   icon: 'ri-shopping-bag-3-line', label: 'Pedidos',           seccion: 'admin', badge: 'pedidos' },
        { id: 'sec-admin-servicios', icon: 'ri-user-star-line',      label: 'Servicios',         seccion: 'admin' },
        { id: 'sec-admin-usuarios',  icon: 'ri-team-line',           label: 'Usuarios',          seccion: 'admin', badge: 'usuarios' },
        { id: 'sec-admin-blog',      icon: 'ri-article-line',        label: 'Blog',              seccion: 'admin' },
        { id: 'sec-admin-mensajes',  icon: 'ri-mail-line',           label: 'Mensajes',          seccion: 'admin', badge: 'mensajes' }
    ];

    var MENU_CLIENTE = [
        { id: 'sec-cliente-pedidos',   icon: 'ri-shopping-bag-line',  label: 'Mis Pedidos',   seccion: 'cliente' },
        { id: 'sec-cliente-servicios', icon: 'ri-calendar-check-line',label: 'Mis Servicios', seccion: 'cliente' },
        { id: 'sec-cliente-favoritos', icon: 'ri-heart-line',          label: 'Favoritos',     seccion: 'cliente' },
        { id: 'sec-cliente-perfil',    icon: 'ri-user-settings-line',  label: 'Mi Perfil',     seccion: 'cliente' }
    ];

    function renderMenu(rol) {
        var nav      = document.getElementById('d-sidebar-nav');
        var menuDef  = rol === 'admin' ? MENU_ADMIN : MENU_CLIENTE;
        var secLabel = rol === 'admin' ? 'Administración' : 'Mi Cuenta';
        var html     = '<p class="d-sidebar__section-label">' + secLabel + '</p>';

        menuDef.forEach(function (item) {
            html +=
                '<button class="d-sidebar__item" data-seccion="' + item.id + '" type="button">' +
                '<i class="' + item.icon + '" aria-hidden="true"></i>' +
                '<span>' + item.label + '</span>' +
                (item.badge ? '<span class="d-sidebar__badge" id="badge-' + item.badge + '">0</span>' : '') +
                '<span class="d-tooltip">' + item.label + '</span>' +
                '</button>';
        });

        nav.innerHTML = html;

        // Eventos de clic
        nav.querySelectorAll('.d-sidebar__item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                Dashboard.irA(btn.dataset.seccion);
                // Cerrar en móvil
                if (window.innerWidth <= 768) cerrarMovil();
            });
        });
    }

    function marcarActivo(seccionId) {
        document.querySelectorAll('.d-sidebar__item').forEach(function (btn) {
            btn.classList.toggle('activo', btn.dataset.seccion === seccionId);
        });
    }

    function toggle() {
        _colapsado = !_colapsado;
        var sidebar  = document.getElementById('d-sidebar');
        var topbar   = document.getElementById('d-topbar');
        var content  = document.getElementById('d-content');
        var icon     = document.querySelector('#d-sidebar-toggle i');
        sidebar.classList.toggle('colapsado', _colapsado);
        topbar.classList.toggle('sidebar-colapsado', _colapsado);
        content.classList.toggle('sidebar-colapsado', _colapsado);
        if (icon) icon.style.transform = _colapsado ? 'rotate(180deg)' : '';
    }

    function abrirMovil() {
        document.getElementById('d-sidebar').classList.add('movil-abierto');
        document.getElementById('d-sidebar-overlay').classList.add('activo');
        document.body.style.overflow = 'hidden';
    }

    function cerrarMovil() {
        document.getElementById('d-sidebar').classList.remove('movil-abierto');
        document.getElementById('d-sidebar-overlay').classList.remove('activo');
        document.body.style.overflow = '';
    }

    function configurarEventos() {
        var toggleBtn = document.getElementById('d-sidebar-toggle');
        if (toggleBtn) toggleBtn.addEventListener('click', toggle);

        var mobileBtn = document.getElementById('d-mobile-toggle');
        if (mobileBtn) mobileBtn.addEventListener('click', abrirMovil);

        var overlay = document.getElementById('d-sidebar-overlay');
        if (overlay) overlay.addEventListener('click', cerrarMovil);
    }

    function actualizarBadges() {
        // Badge de pedidos pendientes
        var badgePed = document.getElementById('badge-pedidos');
        if (badgePed) {
            var pendientes = DStore.getPedidos().filter(function(p) { return p.estado === 'pendiente'; }).length;
            badgePed.textContent = pendientes;
            badgePed.style.display = pendientes > 0 ? '' : 'none';
        }

        // Badge de mensajes no leídos
        var badgeMsg = document.getElementById('badge-mensajes');
        if (badgeMsg) {
            var noLeidos = DStore.getMensajes().filter(function(m) { return !m.leido; }).length;
            badgeMsg.textContent = noLeidos;
            badgeMsg.style.display = noLeidos > 0 ? '' : 'none';
        }

        // Badge de total de usuarios registrados
        var badgeUsr = document.getElementById('badge-usuarios');
        if (badgeUsr) {
            var totalUsr = DStore.getUsuarios().length;
            badgeUsr.textContent = totalUsr;
            badgeUsr.style.display = totalUsr > 0 ? '' : 'none';
        }
    }

    return { renderMenu, marcarActivo, toggle, configurarEventos, actualizarBadges };

})();


// ═══════════════════════════════════════════════════════════════════════════
// DRENDER — Renderizadores de cada sección
// ═══════════════════════════════════════════════════════════════════════════
var DRender = (function () {

    'use strict';

    // ── Utilidades ──────────────────────────────────────────────────────────
    function esc(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function formatoCOP(n) {
        return '$' + Math.round(n || 0).toLocaleString('es-CO');
    }

    function formatoFecha(iso) {
        if (!iso) return '—';
        var d = new Date(iso);
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function badgeEstado(estado) {
        var mapa = {
            pendiente: 'Pendiente', proceso: 'En Proceso', enviado: 'Enviado',
            completado: 'Completado', nuevo: 'Nuevo', leido: 'Leído',
            activo: 'Activo', cancelado: 'Cancelado'
        };
        return '<span class="d-status d-status--' + esc(estado) + '">' + esc(mapa[estado] || estado) + '</span>';
    }

    function avatarIniciales(nombre) {
        var partes = String(nombre || 'U').trim().split(' ');
        return (partes[0][0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
    }

    function vacio(icono, titulo, desc) {
        return '<div class="d-empty">' +
            '<i class="' + icono + ' d-empty__icon" aria-hidden="true"></i>' +
            '<p class="d-empty__title">' + titulo + '</p>' +
            '<p class="d-empty__desc">' + desc + '</p></div>';
    }

    // ── ADMIN: KPIs ──────────────────────────────────────────────────────────
    function renderKpis() {
        var pedidos   = DStore.getPedidos();
        var servicios = DStore.getServicios();
        var mensajes  = DStore.getMensajes();

        var totalVentas    = pedidos.filter(function(p){ return p.estado === 'completado'; })
                                   .reduce(function(a,p){ return a + (p.total || 0); }, 0);
        var pedidosPend    = pedidos.filter(function(p){ return p.estado === 'pendiente'; }).length;
        var serviciosActivos = servicios.filter(function(s){ return s.estado === 'activo' || s.estado === 'pendiente'; }).length;
        var msgNuevos      = mensajes.filter(function(m){ return !m.leido; }).length;

        var kpis = [
            { clase: 'ventas',    icon: 'ri-money-dollar-circle-line', label: 'Ventas Totales',       valor: formatoCOP(totalVentas), delta: '+12% vs mes anterior' },
            { clase: 'pedidos',   icon: 'ri-shopping-bag-3-line',      label: 'Pedidos Pendientes',   valor: pedidosPend,            delta: pedidos.length + ' total' },
            { clase: 'servicios', icon: 'ri-user-star-line',           label: 'Servicios Activos',    valor: serviciosActivos,       delta: servicios.length + ' total' },
            { clase: 'mensajes',  icon: 'ri-mail-line',                label: 'Mensajes Sin Leer',    valor: msgNuevos,              delta: mensajes.length + ' total' }
        ];

        var html = '';
        kpis.forEach(function (k) {
            html +=
                '<div class="d-kpi d-kpi--' + k.clase + '">' +
                '<div class="d-kpi__top">' +
                '<span class="d-kpi__label">' + k.label + '</span>' +
                '<span class="d-kpi__icon"><i class="' + k.icon + '" aria-hidden="true"></i></span>' +
                '</div>' +
                '<div class="d-kpi__valor">' + k.valor + '</div>' +
                '<div class="d-kpi__delta"><i class="ri-arrow-up-line"></i>' + k.delta + '</div>' +
                '</div>';
        });

        var el = document.getElementById('admin-kpis');
        if (el) el.innerHTML = html;
    }

    // ── ADMIN: Gráficos ──────────────────────────────────────────────────────
    function renderGraficos() {
        // Datos de ventas por mes (simulados a partir de pedidos completados)
        var meses   = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        var pedidos = DStore.getPedidos();
        var porMes  = {};
        pedidos.forEach(function(p) {
            if (p.estado === 'completado' && p.fecha) {
                var m = meses[new Date(p.fecha).getMonth()];
                porMes[m] = (porMes[m] || 0) + (p.total || 0);
            }
        });

        // Completar meses sin datos con valores demo
        var DEMO = { Ene:1200000, Feb:980000, Mar:1450000, Abr:1100000, May:1800000, Jun:2100000,
                     Jul:1650000, Ago:1900000, Sep:2300000, Oct:1750000, Nov:2550000, Dic:3100000 };
        var datosBarras = meses.map(function(m) {
            return { label: m, valor: porMes[m] || DEMO[m] };
        });

        DCharts.renderBarras('chart-ventas', datosBarras);

        // Donut por categorías
        var catMap = {};
        pedidos.forEach(function(p) {
            if (!p.productos) return;
            // Mapeo simple por palabras clave en el texto de productos
            var cats = ['Suplementos','Indumentaria','Equipamiento','Accesorios'];
            cats.forEach(function(c) {
                if (p.productos.indexOf(c) >= 0 || Math.random() < 0.25) {
                    catMap[c] = (catMap[c] || 0) + 1;
                }
            });
        });

        // Demo si no hay datos suficientes
        if (Object.keys(catMap).length === 0) {
            catMap = { Suplementos: 42, Indumentaria: 28, Equipamiento: 18, Accesorios: 12 };
        }

        var donutData = Object.keys(catMap).map(function(k) {
            return { label: k, valor: catMap[k] };
        });

        DCharts.renderDonut('donut-categorias', donutData);
    }

    // ── ADMIN: Tabla de pedidos ──────────────────────────────────────────────
    function renderTablaPedidos() {
        var tbody   = document.getElementById('admin-pedidos-tbody');
        var pedidos = DStore.getPedidos();
        if (!tbody) return;

        if (pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">' + vacio('ri-shopping-bag-line', 'Sin pedidos', 'Aún no hay pedidos registrados.') + '</td></tr>';
            return;
        }

        var ESTADOS = ['pendiente','proceso','enviado','completado'];
        tbody.innerHTML = pedidos.map(function (p) {
            var initials = avatarIniciales(p.clienteNombre);
            var selectOpts = ESTADOS.map(function(e) {
                return '<option value="' + e + '"' + (p.estado === e ? ' selected' : '') + '>' +
                    { pendiente:'Pendiente', proceso:'En Proceso', enviado:'Enviado', completado:'Completado' }[e] +
                    '</option>';
            }).join('');

            return '<tr>' +
                '<td><span class="d-table__id">' + esc(p.id) + '</span></td>' +
                '<td><div class="d-table__user">' +
                '<div class="d-table__avatar">' + initials + '</div>' +
                '<span>' + esc(p.clienteNombre) + '</span></div></td>' +
                '<td class="d-table__hide-mobile" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                esc(p.productos) + '</td>' +
                '<td style="font-weight:700;font-family:var(--d-font-head);">' + formatoCOP(p.total) + '</td>' +
                '<td>' +
                '<select class="d-select-estado" data-pedido-id="' + esc(p.id) + '" aria-label="Estado del pedido ' + esc(p.id) + '">' +
                selectOpts + '</select></td>' +
                '<td><div class="d-action-btns">' +
                '<button class="d-btn-icon" title="Ver detalle" onclick="DRender.verDetallePedido(\'' + esc(p.id) + '\')">' +
                '<i class="ri-eye-line" aria-hidden="true"></i></button>' +
                '</div></td>' +
                '</tr>';
        }).join('');

        // Listener para cambios de estado
        tbody.querySelectorAll('.d-select-estado').forEach(function (sel) {
            sel.addEventListener('change', function () {
                DStore.actualizarEstadoPedido(sel.dataset.pedidoId, sel.value);
                DSidebar.actualizarBadges();
                DToast.ok('Estado del pedido ' + sel.dataset.pedidoId + ' actualizado.');
            });
        });
    }

    function verDetallePedido(id) {
        var p = DStore.getPedidos().find(function(x){ return x.id === id; });
        if (!p) return;
        DToast.info('Pedido ' + id + ' | ' + p.clienteNombre + ' | ' + formatoCOP(p.total) + ' | ' + p.estado);
    }

    // ── ADMIN: Servicios ─────────────────────────────────────────────────────
    function renderServiciosAdmin() {
        var el = document.getElementById('admin-servicios-list');
        if (!el) return;
        var servicios = DStore.getServicios();

        if (servicios.length === 0) {
            el.innerHTML = vacio('ri-user-star-line','Sin solicitudes','No hay solicitudes de servicios.');
            return;
        }

        var html = '';
        servicios.forEach(function (s) {
            var iconos = { 'Plan de Entrenamiento':'ri-run-line','Asesoría Nutricional':'ri-seedling-line','Reserva Showroom':'ri-store-2-line' };
            var ico    = iconos[s.tipo] || 'ri-user-star-line';
            var bgCol  = { activo:'var(--d-verde-bg)', pendiente:'var(--d-amarillo-bg)', completado:'var(--d-fondo)' };
            var fgCol  = { activo:'var(--d-verde)', pendiente:'var(--d-amarillo)', completado:'var(--d-plata-dark)' };

            html +=
                '<div class="d-servicio-item">' +
                '<div class="d-servicio-item__icon" style="background:' + (bgCol[s.estado]||bgCol.pendiente) + ';color:' + (fgCol[s.estado]||fgCol.pendiente) + ';">' +
                '<i class="' + ico + '" aria-hidden="true"></i></div>' +
                '<div style="flex:1;min-width:0;">' +
                '<div style="font-weight:700;font-size:0.88rem;">' + esc(s.clienteNombre) + '</div>' +
                '<div style="font-size:0.78rem;color:var(--d-texto-mut);">' + esc(s.tipo) + ' · ' + esc(s.duracion) + ' · ' + formatoFecha(s.fecha) + '</div>' +
                '</div>' +
                badgeEstado(s.estado) +
                '<select class="d-select-estado" data-srv-id="' + esc(s.id) + '" aria-label="Estado servicio">' +
                ['pendiente','activo','completado','cancelado'].map(function(e){
                    return '<option value="' + e + '"' + (s.estado===e?' selected':'') + '>' + {pendiente:'Pendiente',activo:'Activo',completado:'Completado',cancelado:'Cancelado'}[e] + '</option>';
                }).join('') +
                '</select></div>';
        });

        el.innerHTML = html;

        el.querySelectorAll('.d-select-estado').forEach(function(sel) {
            sel.addEventListener('change', function() {
                DStore.actualizarEstadoServicio(sel.dataset.srvId, sel.value);
                renderServiciosAdmin();
                DToast.ok('Servicio actualizado.');
            });
        });
    }

    // ── ADMIN: Blog ──────────────────────────────────────────────────────────
    function renderBlogAdmin() {
        var el   = document.getElementById('admin-blog-list');
        var cnt  = document.getElementById('blog-count');
        if (!el) return;

        var posts = DStore.getBlog();
        if (cnt) cnt.textContent = posts.length + ' post' + (posts.length !== 1 ? 's' : '');

        if (posts.length === 0) {
            el.innerHTML = vacio('ri-article-line','Sin artículos','Publica tu primer artículo del blog.');
            return;
        }

        el.innerHTML = posts.map(function (p) {
            return '<div class="d-post-item">' +
                '<div class="d-post-item__icon"><i class="ri-article-line" aria-hidden="true"></i></div>' +
                '<div class="d-post-item__info">' +
                '<div class="d-post-item__titulo">' + esc(p.titulo) + '</div>' +
                '<div class="d-post-item__meta">' + esc(p.categoria) + ' · ' + formatoFecha(p.fecha) + '</div>' +
                '</div>' +
                '<div class="d-action-btns">' +
                '<button class="d-btn-icon" title="Editar" onclick="DRender.editarPost(\'' + esc(p.id) + '\')">' +
                '<i class="ri-edit-line" aria-hidden="true"></i></button>' +
                '<button class="d-btn-icon eliminar" title="Eliminar" onclick="DRender.eliminarPostUI(\'' + esc(p.id) + '\')">' +
                '<i class="ri-delete-bin-6-line" aria-hidden="true"></i></button>' +
                '</div></div>';
        }).join('');
    }

    function editarPost(id) {
        var post = DStore.getBlog().find(function(p){ return p.id === id; });
        if (!post) return;

        document.getElementById('blog-id-edit').value      = post.id;
        document.getElementById('blog-titulo').value       = post.titulo;
        document.getElementById('blog-categoria').value    = post.categoria;
        document.getElementById('blog-extracto').value     = post.extracto;
        document.getElementById('blog-btn-texto').textContent = 'Actualizar';
        document.querySelector('#blog-form-titulo').innerHTML =
            '<i class="ri-edit-2-line" aria-hidden="true"></i> Editar Artículo';

        document.getElementById('form-blog').scrollIntoView({ behavior: 'smooth' });
    }

    function eliminarPostUI(id) {
        if (!confirm('¿Eliminar este artículo? Esta acción no se puede deshacer.')) return;
        DStore.eliminarPost(id);
        renderBlogAdmin();
        DToast.ok('Artículo eliminado.');
    }

    // ── ADMIN: Mensajes ──────────────────────────────────────────────────────
    function renderMensajesAdmin() {
        var el     = document.getElementById('admin-mensajes-list');
        var badge  = document.getElementById('msg-no-leidos-badge');
        if (!el) return;

        var msgs     = DStore.getMensajes();
        var noLeidos = msgs.filter(function(m){ return !m.leido; }).length;

        if (badge) badge.textContent = noLeidos + ' nuevo' + (noLeidos !== 1 ? 's' : '');

        if (msgs.length === 0) {
            el.innerHTML = vacio('ri-mail-open-line','Bandeja vacía','No hay mensajes recibidos.');
            return;
        }

        el.innerHTML = msgs.map(function (m) {
            return '<div class="d-msg-item' + (m.leido ? '' : ' no-leido') + '" data-msg-id="' + esc(m.id) + '">' +
                '<div class="d-msg-item__avatar">' + avatarIniciales(m.nombre) + '</div>' +
                '<div class="d-msg-item__body">' +
                '<div class="d-msg-item__head">' +
                '<span class="d-msg-item__nombre">' + esc(m.nombre) + '</span>' +
                '<span class="d-msg-item__fecha">' + formatoFecha(m.fecha) + '</span>' +
                '</div>' +
                '<div class="d-msg-item__asunto">' + esc(m.asunto) + '</div>' +
                '<div class="d-msg-item__preview">' + esc(m.mensaje) + '</div>' +
                '</div>' +
                '<div class="d-msg-item__actions">' +
                (!m.leido ?
                    '<button class="d-btn-icon exito" title="Marcar como leído" onclick="DRender.marcarLeido(\'' + esc(m.id) + '\')">' +
                    '<i class="ri-check-line" aria-hidden="true"></i></button>' : '') +
                '<button class="d-btn-icon" title="Responder por WhatsApp" onclick="window.open(\'https://wa.me/\' + \'' + esc(m.email) + '\'.replace(/[^0-9]/g,\'\'), \'_blank\')">' +
                '<i class="ri-mail-send-line" aria-hidden="true"></i></button>' +
                '</div></div>';
        }).join('');

        // Clic en el mensaje → expandir (toggle leído)
        el.querySelectorAll('.d-msg-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.d-msg-item__actions')) return;
                var id = item.dataset.msgId;
                DStore.marcarMensajeLeido(id);
                renderMensajesAdmin();
                DSidebar.actualizarBadges();
            });
        });
    }

    function marcarLeido(id) {
        DStore.marcarMensajeLeido(id);
        renderMensajesAdmin();
        DSidebar.actualizarBadges();
        DToast.ok('Mensaje marcado como leído.');
    }

    // ── CLIENTE: Pedidos ─────────────────────────────────────────────────────
    function renderPedidosCliente(usuario) {
        var el      = document.getElementById('cliente-pedidos-contenedor');
        if (!el) return;
        var pedidos = DStore.getPedidosDeUsuario(usuario.id);

        if (pedidos.length === 0) {
            el.innerHTML = '<div class="d-card"><div class="d-card__body">' +
                vacio('ri-shopping-bag-line','Sin pedidos','Aún no has realizado ningún pedido.') +
                '</div></div>';
            return;
        }

        el.innerHTML = pedidos.map(function (p) {
            var PASOS = [
                { key: 'pendiente',  label: 'Pedido recibido',     desc: 'Tu pedido ha sido registrado.' },
                { key: 'proceso',    label: 'En preparación',       desc: 'Estamos alistando tus productos.' },
                { key: 'enviado',    label: 'En camino',            desc: 'Tu pedido fue despachado.' },
                { key: 'completado', label: 'Entregado',            desc: '¡Tu pedido llegó exitosamente!' }
            ];

            var orden = ['pendiente','proceso','enviado','completado'];
            var idx   = orden.indexOf(p.estado);

            var timelineHtml = '<div class="d-timeline">' +
                PASOS.map(function(paso, i) {
                    var cls = i < idx ? 'hecho' : i === idx ? 'actual' : '';
                    return '<div class="d-timeline__step ' + cls + '">' +
                        '<div class="d-timeline__label">' + paso.label + '</div>' +
                        '<div class="d-timeline__desc">' + paso.desc + '</div>' +
                        '</div>';
                }).join('') +
                '</div>';

            return '<div class="d-card" style="margin-bottom:20px;">' +
                '<div class="d-card__head">' +
                '<span class="d-card__title"><i class="ri-shopping-bag-3-line" aria-hidden="true"></i>' +
                'Pedido <span class="d-table__id" style="margin-left:6px;">' + esc(p.id) + '</span></span>' +
                '<div style="display:flex;gap:8px;align-items:center;">' +
                badgeEstado(p.estado) +
                '<span style="font-family:var(--d-font-head);font-weight:800;color:var(--d-vino);">' + formatoCOP(p.total) + '</span>' +
                '</div></div>' +
                '<div class="d-card__body">' +
                '<div style="margin-bottom:16px;">' +
                '<p style="font-size:0.82rem;color:var(--d-texto-mut);margin-bottom:4px;">Productos</p>' +
                '<p style="font-size:0.88rem;font-weight:500;">' + esc(p.productos) + '</p>' +
                '<p style="font-size:0.78rem;color:var(--d-texto-mut);margin-top:4px;">Fecha: ' + formatoFecha(p.fecha) + '</p>' +
                '</div>' +
                timelineHtml +
                '</div></div>';
        }).join('');
    }

    // ── CLIENTE: Servicios ───────────────────────────────────────────────────
    function renderServiciosCliente(usuario) {
        var el = document.getElementById('cliente-servicios-list');
        if (!el) return;

        var servicios = DStore.getServiciosDeUsuario(usuario.id);

        if (servicios.length === 0) {
            el.innerHTML = vacio('ri-calendar-line','Sin servicios','No tienes servicios contratados aún.');
            return;
        }

        var html = '';
        servicios.forEach(function (s) {
            html +=
                '<div class="d-servicio-item">' +
                '<div class="d-servicio-item__icon" style="background:var(--d-vino-ghost);color:var(--d-vino);">' +
                '<i class="ri-user-star-line" aria-hidden="true"></i></div>' +
                '<div style="flex:1;min-width:0;">' +
                '<div style="font-weight:700;font-size:0.9rem;">' + esc(s.tipo) + '</div>' +
                '<div style="font-size:0.78rem;color:var(--d-texto-mut);">Coach: ' + esc(s.coach) + ' · ' + esc(s.duracion) + '</div>' +
                '<div style="font-size:0.76rem;color:var(--d-texto-mut);">Inicio: ' + formatoFecha(s.inicio || s.fecha) + '</div>' +
                '</div>' +
                badgeEstado(s.estado) +
                '</div>';
        });

        el.innerHTML = html;
    }

    // ── CLIENTE: Favoritos ───────────────────────────────────────────────────
    function renderFavoritos(usuario) {
        var el = document.getElementById('cliente-favs-grid');
        if (!el) return;

        var favs = DStore.getFavoritos(usuario.id);

        if (favs.length === 0) {
            el.innerHTML = '<div style="grid-column:1/-1;">' +
                vacio('ri-heart-line','Sin favoritos','Agrega productos o artículos a tus favoritos.') +
                '</div>';
            return;
        }

        el.innerHTML = favs.map(function (f) {
            var imgHtml = f.imagen
                ? '<img src="' + esc(f.imagen) + '" alt="' + esc(f.nombre) + '" loading="lazy">'
                : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--d-plata);font-size:2.2rem;"><i class="ri-article-line"></i></div>';

            return '<div class="d-fav-card">' +
                '<div class="d-fav-card__img">' + imgHtml + '</div>' +
                '<div class="d-fav-card__body">' +
                '<div class="d-fav-card__tag">' + esc(f.categoria) + '</div>' +
                '<div class="d-fav-card__name">' + esc(f.nombre) + '</div>' +
                '<div class="d-fav-card__foot">' +
                '<span class="d-fav-card__price">' + (f.precio ? formatoCOP(f.precio) : 'Artículo') + '</span>' +
                '<button class="d-btn-icon eliminar" title="Quitar de favoritos" onclick="DRender.quitarFavorito(\'' + esc(f.id) + '\',\'' + esc(usuario.id) + '\')">' +
                '<i class="ri-heart-fill" style="color:var(--d-vino);" aria-hidden="true"></i></button>' +
                '</div></div></div>';
        }).join('');
    }

    function quitarFavorito(favId, uid) {
        var favs = DStore.getFavoritos(uid).filter(function(f){ return f.id !== favId; });
        DStore.setFavoritos(uid, favs);
        Dashboard.renderSeccionActual();
        DToast.ok('Eliminado de favoritos.');
    }

    // ── ADMIN: Gestión de Usuarios ───────────────────────────────────────────
    function renderUsuariosAdmin() {
        var tbody = document.getElementById('admin-usuarios-tbody');
        var total = document.getElementById('admin-usuarios-total');
        if (!tbody) return;

        var usuarios = DStore.getUsuarios();
        if (total) total.textContent = usuarios.length + ' usuario' + (usuarios.length !== 1 ? 's' : '');

        if (usuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">' + vacio('ri-team-line', 'Sin usuarios', 'No hay usuarios registrados.') + '</td></tr>';
            return;
        }

        tbody.innerHTML = usuarios.map(function (u) {
            var initials = avatarIniciales(u.nombre);
            var esAdmin  = u.role === 'admin';
            var esProtegido = u.id === 'usr_admin_prana_default';

            return '<tr>' +
                '<td>' +
                  '<div class="d-table__user">' +
                  '<div class="d-table__avatar" style="' + (esAdmin ? 'background:linear-gradient(135deg,#5C0A1B,#7A1429);color:#fff;' : '') + '">' + initials + '</div>' +
                  '<div><div style="font-weight:600;font-size:0.88rem;">' + esc(u.nombre) + '</div>' +
                  '<div style="font-size:0.74rem;color:var(--d-texto-mut);">' + esc(u.email) + '</div></div>' +
                  '</div></td>' +
                '<td>' +
                  '<span class="d-status ' + (esAdmin ? 'd-status--enviado' : 'd-status--activo') + '">' +
                  (esAdmin ? 'Admin' : 'Cliente') + '</span></td>' +
                '<td class="d-table__hide-mobile" style="font-size:0.78rem;color:var(--d-texto-mut);">' +
                  (u.creadoEn ? new Date(u.creadoEn).toLocaleDateString('es-CO') : '—') +
                '</td>' +
                '<td><div class="d-action-btns">' +
                  '<button class="d-btn-icon" title="Editar usuario" ' +
                  'onclick="DRender.abrirModalEditarUsuario(\'' + esc(u.id) + '\')">' +
                  '<i class="ri-edit-line" aria-hidden="true"></i></button>' +
                  (!esProtegido ?
                    '<button class="d-btn-icon eliminar" title="Eliminar usuario" ' +
                    'onclick="DRender.eliminarUsuarioUI(\'' + esc(u.id) + '\')">' +
                    '<i class="ri-delete-bin-6-line" aria-hidden="true"></i></button>' : '') +
                '</div></td>' +
                '</tr>';
        }).join('');
    }

    function abrirModalEditarUsuario(uid) {
        var usuarios = DStore.getUsuarios();
        var u        = usuarios.find(function (x) { return x.id === uid; });
        if (!u) return;

        // Rellenar el formulario del modal
        var setVal = function(id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; };
        setVal('edit-usr-id',     u.id);
        setVal('edit-usr-nombre', u.nombre);
        setVal('edit-usr-email',  u.email);
        setVal('edit-usr-pwd',    '');
        setVal('edit-usr-pwd2',   '');

        var rolSel = document.getElementById('edit-usr-rol');
        if (rolSel) rolSel.value = u.role === 'admin' ? 'admin' : 'cliente';

        // Título del modal
        var titulo = document.getElementById('modal-usr-titulo');
        if (titulo) titulo.textContent = 'Editar: ' + u.nombre;

        // Mostrar modal
        var overlay = document.getElementById('modal-usr-overlay');
        if (overlay) {
            overlay.classList.add('d-modal--visible');
            overlay.setAttribute('aria-hidden', 'false');
            var primerInput = document.getElementById('edit-usr-nombre');
            if (primerInput) setTimeout(function() { primerInput.focus(); }, 200);
        }
    }

    function cerrarModalEditarUsuario() {
        var overlay = document.getElementById('modal-usr-overlay');
        if (overlay) {
            overlay.classList.remove('d-modal--visible');
            overlay.setAttribute('aria-hidden', 'true');
        }
    }

    function eliminarUsuarioUI(uid) {
        var u = DStore.getUsuarios().find(function(x){ return x.id === uid; });
        if (!u) return;
        if (!confirm('¿Eliminar al usuario "' + u.nombre + '"? Esta acción no se puede deshacer.')) return;

        // Obtener uid del usuario activo para la protección
        var sesion = JSON.parse(localStorage.getItem('prana_sesion') || '{}');
        var uidActivo = (sesion.usuario && sesion.usuario.id) ? sesion.usuario.id : '';

        var ok = DStore.eliminarUsuario(uid, uidActivo);
        if (ok) {
            renderUsuariosAdmin();
            DSidebar.actualizarBadges();
            DToast.ok('Usuario eliminado.');
        } else {
            DToast.error('No se puede eliminar este usuario.');
        }
    }

    // ── CLIENTE: Perfil ──────────────────────────────────────────────────────
    function cargarPerfil(usuario) {
        var perfil = DStore.getPerfil(usuario.id);
        var set = function(id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; };

        set('perfil-nombre',    perfil.nombre    || usuario.nombre);
        set('perfil-email',     usuario.email);
        set('perfil-telefono',  perfil.telefono);
        set('perfil-ciudad',    perfil.ciudad);
        set('perfil-direccion', perfil.direccion);
        set('fitness-objetivo',   perfil.fitnesObjetivo   || '');
        set('fitness-frecuencia', perfil.fitnesFrecuencia || '');
    }

    return {
        renderKpis, renderGraficos, renderTablaPedidos,
        renderServiciosAdmin, renderBlogAdmin, editarPost, eliminarPostUI,
        renderMensajesAdmin, marcarLeido,
        renderPedidosCliente, renderServiciosCliente,
        renderFavoritos, quitarFavorito,
        cargarPerfil,
        verDetallePedido,
        // Usuarios admin
        renderUsuariosAdmin, abrirModalEditarUsuario, cerrarModalEditarUsuario,
        eliminarUsuarioUI,
        formatoCOP, formatoFecha, esc
    };

})();


// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD — Orquestador principal
// ═══════════════════════════════════════════════════════════════════════════
var Dashboard = (function () {

    'use strict';

    var _usuario    = null;
    var _rol        = 'cliente';
    var _seccionId  = '';

    // ── Mapa sección → render ────────────────────────────────────────────────
    var RENDERS = {
        'sec-admin-resumen':   function () {
            DRender.renderKpis();
            DRender.renderGraficos();
        },
        'sec-admin-pedidos':   function () { DRender.renderTablaPedidos(); },
        'sec-admin-servicios': function () { DRender.renderServiciosAdmin(); },
        'sec-admin-usuarios':  function () { DRender.renderUsuariosAdmin(); },
        'sec-admin-blog':      function () { DRender.renderBlogAdmin(); },
        'sec-admin-mensajes':  function () { DRender.renderMensajesAdmin(); },

        'sec-cliente-pedidos':   function () { DRender.renderPedidosCliente(_usuario); },
        'sec-cliente-servicios': function () { DRender.renderServiciosCliente(_usuario); },
        'sec-cliente-favoritos': function () { DRender.renderFavoritos(_usuario); },
        'sec-cliente-perfil':    function () { DRender.cargarPerfil(_usuario); }
    };

    // ── Guard de sesión ──────────────────────────────────────────────────────
    function verificarSesion() {
        // 1. AuthService debe estar disponible
        if (typeof AuthService === 'undefined') {
            console.error('[Dashboard] AuthService no disponible. Revisa el orden de scripts.');
            window.location.replace('login.html');
            return null;
        }

        // 2. Debe haber sesión activa y no expirada
        if (!AuthService.estaAutenticado()) {
            sessionStorage.setItem('prana_login_retorno', window.location.href);
            window.location.replace('login.html');
            return null;
        }

        // 3. El objeto de usuario debe ser válido
        var usuario = AuthService.getCurrentUser();
        if (!usuario || !usuario.id) {
            // Sesión corrupta — limpiarla y redirigir
            try { AuthService.cerrarSesion(); } catch (e) {}
            window.location.replace('login.html');
            return null;
        }

        return usuario;
    }

    // ── Determinar rol ───────────────────────────────────────────────────────
    // PRIORIDAD DE LECTURA (de más a menos fiable):
    //   1. prana_sesion → usuario.role  (puesto por auth.js al hacer login)
    //   2. prana_usuarios → usuario con ese id → role  (fallback si la sesión
    //      fue creada antes del fix que incluye el role en la sesión)
    //   3. 'cliente' por defecto — nunca lanza error ni bloquea
    function obtenerRol(usuario) {
        if (!usuario || !usuario.id) return 'cliente';

        // 1. Leer rol desde la sesión activa (camino normal post-fix)
        try {
            var raw = localStorage.getItem('prana_sesion');
            var ses = raw ? JSON.parse(raw) : null;
            if (ses && ses.usuario && typeof ses.usuario.role === 'string' && ses.usuario.role.length > 0) {
                // Normalizar: solo se acepta 'admin' o 'cliente'
                return ses.usuario.role === 'admin' ? 'admin' : 'cliente';
            }
        } catch (e) { /* fallback silencioso */ }

        // 2. Fallback: leer directamente desde prana_usuarios
        // Cubre sesiones creadas con la versión anterior de auth.js (sin role)
        try {
            var usuarios = JSON.parse(localStorage.getItem('prana_usuarios') || '[]');
            var dbUser   = usuarios.find(function (u) { return u.id === usuario.id; });
            if (dbUser && dbUser.role === 'admin') return 'admin';
        } catch (e) { /* fallback silencioso */ }

        // 3. Seguro por defecto
        return 'cliente';
    }

    // ── Inicialización ───────────────────────────────────────────────────────
    function init() {
        // Ejecutar seed del admin y luego iniciar el dashboard
        // AdminSeed.sembrar() es async (usa Hash.crearHash), por eso usamos
        // .then() para garantizar que el admin existe antes del guard de sesión.
        var seedPromise = (typeof AdminSeed !== 'undefined')
            ? AdminSeed.sembrar()
            : Promise.resolve();

        seedPromise.catch(function () {
            // Si el seed falla (ej. Hash no disponible), continuamos igual.
            // El admin puede crearse manualmente más tarde.
        }).finally(function () {
            _iniciarDespuesDeSeed();
        });

        // Compatibilidad con navegadores que no soportan .finally()
        if (!seedPromise.finally) {
            seedPromise.then(_iniciarDespuesDeSeed, _iniciarDespuesDeSeed);
        }
    }

    function _iniciarDespuesDeSeed() {
        // Pequeño delay para que la pantalla de carga sea visible
        setTimeout(function () {
            _usuario = verificarSesion();
            if (!_usuario) return;           // guard redirigió a login.html

            _rol = obtenerRol(_usuario);

            // Seed de datos de demostración (solo si el store está vacío)
            try { DStore.sembrarDemoSiVacio(_usuario); } catch (e) {}

            // Construir UI
            _construirTopbar();
            DSidebar.renderMenu(_rol);
            DSidebar.configurarEventos();
            DSidebar.actualizarBadges();
            _configurarFormularios();

            // Mostrar layout y ocultar pantalla de carga
            var layout = document.getElementById('d-layout');
            var loader = document.getElementById('d-loading');
            if (layout) layout.style.display = 'flex';
            if (loader) {
                loader.classList.add('oculto');
                setTimeout(function () { loader.style.display = 'none'; }, 450);
            }

            // Ir a la primera sección del rol activo
            var primeraSeccion = _rol === 'admin' ? 'sec-admin-resumen' : 'sec-cliente-pedidos';
            irA(primeraSeccion);

        }, 400);
    }

    function _construirTopbar() {
        var nombre = _usuario.nombre || 'Usuario';

        // Topbar
        var el = document.getElementById('d-topbar-nombre');
        if (el) el.textContent = nombre.split(' ')[0];

        // Badge de rol
        var badgeEl   = document.getElementById('d-badge-rol');
        var badgeTxt  = document.getElementById('d-badge-rol-text');
        if (badgeEl && badgeTxt) {
            badgeEl.className = 'd-badge-rol ' + _rol;
            badgeEl.querySelector('i').className = _rol === 'admin'
                ? 'ri-shield-star-line'
                : 'ri-user-smile-line';
            badgeTxt.textContent = _rol === 'admin' ? 'Administrador' : 'Cliente';
        }

        // Sidebar user card
        var sAvatar = document.getElementById('d-sidebar-avatar');
        var sNombre = document.getElementById('d-sidebar-nombre');
        var sRol    = document.getElementById('d-sidebar-rol');
        var inits   = nombre.trim().split(' ').slice(0,2).map(function(p){ return p[0]; }).join('').toUpperCase();
        if (sAvatar) sAvatar.textContent = inits;
        if (sNombre) sNombre.textContent = nombre;
        if (sRol) {
            sRol.textContent  = _rol === 'admin' ? 'Administrador' : 'Cliente';
            sRol.className    = 'd-sidebar__user-role ' + _rol;
        }

        // Botón logout
        var logoutBtn = document.getElementById('d-btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                AuthService.cerrarSesion();
                DToast.info('Sesión cerrada. Hasta pronto.');
                setTimeout(function () { window.location.replace('login.html'); }, 800);
            });
        }
    }

    // ── Navegación ───────────────────────────────────────────────────────────
    function irA(seccionId) {
        // Verificar que la sección pertenece al rol activo
        // Evita que un cliente pueda acceder a secciones de admin mediante JS
        var seccionEl = document.getElementById(seccionId);
        if (!seccionEl) return;

        var rolRequerido = seccionEl.getAttribute('data-rol');
        if (rolRequerido && rolRequerido !== _rol) {
            // Sección de otro rol: redirigir a la primera sección del rol propio
            var fallback = _rol === 'admin' ? 'sec-admin-resumen' : 'sec-cliente-pedidos';
            if (seccionId !== fallback) irA(fallback);
            return;
        }

        // Ocultar todas las secciones
        document.querySelectorAll('.d-section').forEach(function (s) {
            s.classList.remove('activo');
        });

        // Mostrar la sección objetivo
        seccionEl.classList.add('activo');
        _seccionId = seccionId;

        // Marcar activo en sidebar
        DSidebar.marcarActivo(seccionId);

        // Ejecutar render de la sección con manejo de errores aislado
        if (RENDERS[seccionId]) {
            try {
                RENDERS[seccionId]();
            } catch (err) {
                console.error('[Dashboard] Error al renderizar sección "' + seccionId + '":', err);
                DToast.error('Error al cargar la sección. Por favor recarga la página.');
            }
        }

        // Actualizar badges en el sidebar
        DSidebar.actualizarBadges();

        // Scroll al inicio del contenido
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderSeccionActual() {
        if (_seccionId && RENDERS[_seccionId]) RENDERS[_seccionId]();
    }

    // ── Formularios ──────────────────────────────────────────────────────────
    function _configurarFormularios() {
        _formBlog();
        _formPerfil();
        _formPassword();
        _formFitness();
        _formEditarUsuario();
    }

    function _formEditarUsuario() {
        var form    = document.getElementById('form-edit-usuario');
        var overlay = document.getElementById('modal-usr-overlay');

        if (!form) return;

        // Cerrar al pulsar fuera del modal o botón cancelar
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) DRender.cerrarModalEditarUsuario();
            });
        }
        var btnCancelar = document.getElementById('modal-usr-cancelar');
        if (btnCancelar) btnCancelar.addEventListener('click', DRender.cerrarModalEditarUsuario);

        // Cerrar con Escape
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (overlay && overlay.classList.contains('d-modal--visible')) {
                DRender.cerrarModalEditarUsuario();
            }
        });

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            var uid    = document.getElementById('edit-usr-id').value;
            var nombre = document.getElementById('edit-usr-nombre').value.trim();
            var email  = document.getElementById('edit-usr-email').value.trim();
            var rol    = document.getElementById('edit-usr-rol').value;
            var pwd    = document.getElementById('edit-usr-pwd').value;
            var pwd2   = document.getElementById('edit-usr-pwd2').value;

            if (!nombre) { DToast.error('El nombre es obligatorio.'); return; }
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                DToast.error('Ingresa un correo válido.'); return;
            }

            var cambios = { nombre: nombre, email: email, role: rol };

            // Cambio de contraseña (opcional)
            if (pwd || pwd2) {
                if (pwd.length < 6) { DToast.error('La contraseña debe tener al menos 6 caracteres.'); return; }
                if (pwd !== pwd2)   { DToast.error('Las contraseñas no coinciden.'); return; }

                try {
                    var hashData  = await Hash.crearHash(pwd);
                    cambios.hash  = hashData.hash;
                    cambios.salt  = hashData.salt;
                } catch (err) {
                    DToast.error('Error al procesar la contraseña.'); return;
                }
            }

            var ok = DStore.actualizarUsuario(uid, cambios);
            if (ok) {
                DRender.cerrarModalEditarUsuario();
                DRender.renderUsuariosAdmin();
                DSidebar.actualizarBadges();
                DToast.ok('Usuario actualizado correctamente.');

                // Si el admin editó su propio nombre, actualizar el topbar
                var sesion = JSON.parse(localStorage.getItem('prana_sesion') || '{}');
                if (sesion.usuario && sesion.usuario.id === uid && cambios.nombre) {
                    var topbarNombre = document.getElementById('d-topbar-nombre');
                    if (topbarNombre) topbarNombre.textContent = cambios.nombre.split(' ')[0];
                }
            } else {
                DToast.error('No se pudo actualizar el usuario.');
            }
        });
    }

    function _formBlog() {
        var form = document.getElementById('form-blog');
        if (!form) return;

        var btnCancelar = document.getElementById('blog-btn-cancelar');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', function () {
                form.reset();
                document.getElementById('blog-id-edit').value = '';
                document.getElementById('blog-btn-texto').textContent = 'Publicar';
                document.querySelector('#blog-form-titulo').innerHTML =
                    '<i class="ri-edit-2-line"></i> Nuevo Artículo';
            });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            var titulo    = document.getElementById('blog-titulo').value.trim();
            var categoria = document.getElementById('blog-categoria').value;
            var extracto  = document.getElementById('blog-extracto').value.trim();
            var idEdit    = document.getElementById('blog-id-edit').value;

            if (!titulo || !extracto) {
                DToast.error('Completa el título y el extracto del artículo.');
                return;
            }

            if (idEdit) {
                DStore.actualizarPost(idEdit, { titulo, categoria, extracto });
                DToast.ok('Artículo actualizado exitosamente.');
            } else {
                DStore.crearPost({ titulo, categoria, extracto, autor: _usuario.nombre });
                DToast.ok('Artículo publicado exitosamente.');
            }

            form.reset();
            document.getElementById('blog-id-edit').value = '';
            document.getElementById('blog-btn-texto').textContent = 'Publicar';
            document.querySelector('#blog-form-titulo').innerHTML =
                '<i class="ri-edit-2-line"></i> Nuevo Artículo';

            DRender.renderBlogAdmin();
        });
    }

    function _formPerfil() {
        var form = document.getElementById('form-perfil');
        if (!form) return;

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var datos = {
                nombre:    document.getElementById('perfil-nombre').value.trim(),
                telefono:  document.getElementById('perfil-telefono').value.trim(),
                ciudad:    document.getElementById('perfil-ciudad').value.trim(),
                direccion: document.getElementById('perfil-direccion').value.trim()
            };
            if (!datos.nombre) { DToast.error('El nombre es obligatorio.'); return; }

            DStore.setPerfil(_usuario.id, datos);
            DToast.ok('Perfil actualizado exitosamente.');

            // Actualizar nombre en el topbar y sidebar
            _usuario.nombre = datos.nombre;
            var el = document.getElementById('d-topbar-nombre');
            if (el) el.textContent = datos.nombre.split(' ')[0];
        });
    }

    function _formPassword() {
        var form = document.getElementById('form-password');
        if (!form) return;

        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            var actual    = document.getElementById('pwd-actual').value;
            var nueva     = document.getElementById('pwd-nueva').value;
            var confirmar = document.getElementById('pwd-confirmar').value;

            if (!actual || !nueva || !confirmar) { DToast.error('Completa todos los campos.'); return; }
            if (nueva.length < 6) { DToast.error('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
            if (nueva !== confirmar) { DToast.error('Las contraseñas no coinciden.'); return; }

            // Verificar contraseña actual
            try {
                var usuarios = JSON.parse(localStorage.getItem('prana_usuarios') || '[]');
                var userDB   = usuarios.find(function(u){ return u.id === _usuario.id; });
                if (!userDB) { DToast.error('Usuario no encontrado.'); return; }

                var ok = await Hash.verificarPassword(actual, userDB.salt, userDB.hash);
                if (!ok) { DToast.error('La contraseña actual es incorrecta.'); return; }

                var hashData = await Hash.crearHash(nueva);
                userDB.salt  = hashData.salt;
                userDB.hash  = hashData.hash;
                localStorage.setItem('prana_usuarios', JSON.stringify(usuarios));
                form.reset();
                DToast.ok('Contraseña actualizada correctamente.');
            } catch (err) {
                DToast.error('Error al actualizar la contraseña.');
            }
        });
    }

    function _formFitness() {
        var form = document.getElementById('form-fitness');
        if (!form) return;

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            DStore.setPerfil(_usuario.id, {
                fitnesObjetivo:   document.getElementById('fitness-objetivo').value,
                fitnesFrecuencia: document.getElementById('fitness-frecuencia').value
            });
            DToast.ok('Objetivo fitness guardado.');
        });
    }

    // ── Acciones globales (llamadas desde HTML) ──────────────────────────────
    function cargarDatosSeed() {
        DStore.sembrarDemoSiVacio(_usuario);
        if (RENDERS[_seccionId]) RENDERS[_seccionId]();
        DSidebar.actualizarBadges();
        DToast.info('Datos recargados.');
    }

    function marcarTodosLeidos() {
        DStore.marcarTodosLeidos();
        DRender.renderMensajesAdmin();
        DSidebar.actualizarBadges();
        DToast.ok('Todos los mensajes marcados como leídos.');
    }

    function exportarPedidosCSV() {
        var pedidos = DStore.getPedidos();
        if (!pedidos.length) { DToast.error('No hay pedidos para exportar.'); return; }

        var csv = 'ID,Cliente,Productos,Total,Estado,Fecha\n';
        pedidos.forEach(function(p) {
            csv += [p.id, '"' + (p.clienteNombre||'') + '"', '"' + (p.productos||'') + '"',
                    p.total, p.estado, p.fecha].join(',') + '\n';
        });

        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'prana_pedidos_' + new Date().toISOString().slice(0,10) + '.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        DToast.ok('Pedidos exportados como CSV.');
    }

    return { init, irA, renderSeccionActual, cargarDatosSeed, marcarTodosLeidos, exportarPedidosCSV };

})();

// ── Iniciar cuando el DOM esté listo ────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Dashboard.init);
} else {
    Dashboard.init();
}
