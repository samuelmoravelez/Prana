/**
 * js/dashboard/dashboard-common.js
 * Módulo de utilidades compartidas, formateadores, DToast, DCharts, DSidebar,
 * administración de usuarios, mensajes y perfil extendido.
 */

// ── Cliente Supabase Seguro (No recursivo) ──────────────────────────────────
export async function obtenerClienteSupabase() {
    if (typeof window !== 'undefined' && window.supabaseClient) {
        return window.supabaseClient;
    }
    return new Promise(function (resolve) {
        var elapsed = 0;
        var check = setInterval(function () {
            elapsed += 50;
            if (typeof window !== 'undefined' && window.supabaseClient) {
                clearInterval(check);
                resolve(window.supabaseClient);
            } else if (elapsed >= 5000) {
                clearInterval(check);
                resolve((typeof window !== 'undefined' && window.supabaseClient) || null);
            }
        }, 50);
    });
}

// ── Formateadores y utilidades de renderizado ────────────────────────────────
export function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatoCOP(n) {
    return '$' + Math.round(n || 0).toLocaleString('es-CO');
}

export function formatoFecha(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function badgeEstado(estado) {
    var mapa = {
        pendiente: 'Pendiente', confirmado: 'Confirmado', proceso: 'En Proceso', enviado: 'Enviado',
        completado: 'Completado', nuevo: 'Nuevo', leido: 'Leído',
        activo: 'Activo', cancelado: 'Cancelado'
    };
    return '<span class="d-status d-status--' + esc(estado) + '">' + esc(mapa[estado] || estado) + '</span>';
}

export function avatarIniciales(nombre) {
    var partes = String(nombre || 'U').trim().split(' ');
    return (partes[0][0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
}

export function vacio(icono, titulo, desc) {
    return '<div class="d-empty">' +
        '<i class="' + icono + ' d-empty__icon" aria-hidden="true"></i>' +
        '<p class="d-empty__title">' + titulo + '</p>' +
        '<p class="d-empty__desc">' + desc + '</p></div>';
}

// ── DTOAST — Sistema de notificaciones ───────────────────────────────────────
export var DToast = (function () {
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
            '<span>' + esc(mensaje) + '</span>';

        wrap.appendChild(toast);

        setTimeout(function () {
            toast.classList.add('saliendo');
            setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
        }, duracion);
    }

    function ok(msg)    { mostrar(msg, 'ok'); }
    function error(msg) { mostrar(msg, 'error'); }
    function info(msg)  { mostrar(msg, 'info', 4000); }

    return { mostrar, ok, error, info };
})();

// ── DCHARTS — Gráficos SVG ──────────────────────────────────────────────────
export var DCharts = (function () {
    'use strict';
    var PALETA_BARRAS = ['#5C0A1B','#7A1429','#9A1F38','#B82847','#C84E5E','#D87A85','#8A8A8A','#C0C0C0','#E0E0E0','#F0F0F0','#3B82F6','#10B981'];
    var PALETA_DONUT  = ['#5C0A1B','#7A1429','#3B82F6','#10B981','#F59E0B'];

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
                esc(d.label) + '</text>' +
                '</g>';
        });

        svg.innerHTML =
            '<line x1="' + paddingL + '" y1="' + paddingT + '" x2="' + paddingL + '" y2="' + (paddingT + areaH) +
            '" stroke="#E2E4E8" stroke-width="1.5"/>' +
            '<line x1="' + paddingL + '" y1="' + (paddingT + areaH) + '" x2="' + (W - paddingR) + '" y2="' + (paddingT + areaH) +
            '" stroke="#E2E4E8" stroke-width="1.5" class="d-chart-baseline"/>' +
            lineas + barras;
    }

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
                '<span class="d-donut-legend__label">' + esc(seg.label) + '</span>' +
                '<span class="d-donut-legend__pct">' + pctMostrado + '</span>' +
                '</div>';
        });
        leyendaHtml += '</div>';

        wrap.innerHTML = svgHtml + leyendaHtml;
    }

    return { renderBarras, renderDonut };
})();

// ── DSIDEBAR — Sidebar colapsable y navegación ──────────────────────────────
export var DSidebar = (function () {
    'use strict';
    var _colapsado = false;

    var MENU_ADMIN = [
        { id: 'sec-admin-resumen',   icon: 'ri-dashboard-line',      label: 'Resumen',          seccion: 'admin' },
        { id: 'sec-admin-productos', icon: 'ri-box-3-line',          label: 'Productos',        seccion: 'admin', badge: 'productos' },
        { id: 'sec-admin-pedidos',   icon: 'ri-shopping-bag-3-line', label: 'Pedidos',           seccion: 'admin', badge: 'pedidos' },
        { id: 'sec-admin-servicios', icon: 'ri-user-star-line',      label: 'Servicios',         seccion: 'admin', badge: 'servicios' },
        { id: 'sec-admin-usuarios',  icon: 'ri-team-line',           label: 'Usuarios',          seccion: 'admin', badge: 'usuarios' },
        { id: 'sec-admin-blog',      icon: 'ri-article-line',        label: 'Blog',              seccion: 'admin' },
        { id: 'sec-admin-mensajes',  icon: 'ri-mail-line',           label: 'Mensajes',          seccion: 'admin', badge: 'mensajes' }
    ];

    var MENU_CLIENTE = [
        { id: 'sec-cliente-pedidos',   icon: 'ri-shopping-bag-line',   label: 'Mis Pedidos',   seccion: 'cliente' },
        { id: 'sec-cliente-servicios', icon: 'ri-calendar-check-line', label: 'Mis Servicios', seccion: 'cliente' },
        { id: 'sec-cliente-favoritos', icon: 'ri-heart-line',          label: 'Favoritos',     seccion: 'cliente' },
        { id: 'sec-cliente-perfil',    icon: 'ri-user-settings-line',  label: 'Mi Perfil',     seccion: 'cliente' }
    ];

    function renderMenu(rol) {
        var nav      = document.getElementById('d-sidebar-nav');
        if (!nav) return;
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

        nav.querySelectorAll('.d-sidebar__item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (typeof window.Dashboard !== 'undefined' && window.Dashboard.irA) {
                    window.Dashboard.irA(btn.dataset.seccion);
                }
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
        if (sidebar) sidebar.classList.toggle('colapsado', _colapsado);
        if (topbar)  topbar.classList.toggle('sidebar-colapsado', _colapsado);
        if (content) content.classList.toggle('sidebar-colapsado', _colapsado);
        if (icon) icon.style.transform = _colapsado ? 'rotate(180deg)' : '';
    }

    function abrirMovil() {
        var sidebar = document.getElementById('d-sidebar');
        var overlay = document.getElementById('d-sidebar-overlay');
        if (sidebar) sidebar.classList.add('movil-abierto');
        if (overlay) overlay.classList.add('activo');
        document.body.style.overflow = 'hidden';
    }

    function cerrarMovil() {
        var sidebar = document.getElementById('d-sidebar');
        var overlay = document.getElementById('d-sidebar-overlay');
        if (sidebar) sidebar.classList.remove('movil-abierto');
        if (overlay) overlay.classList.remove('activo');
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
        // Badge de productos en catálogo
        var badgeProd = document.getElementById('badge-productos');
        if (badgeProd) {
            var totalProd = 0;
            if (typeof window.DStore !== 'undefined' && window.DStore.getProductos) {
                var prods = window.DStore.getProductos();
                totalProd = Array.isArray(prods) ? prods.length : 0;
            } else if (typeof ProductosStore !== 'undefined' && ProductosStore.obtenerTodosSync) {
                var prodsSync = ProductosStore.obtenerTodosSync();
                totalProd = Array.isArray(prodsSync) ? prodsSync.length : 0;
            }
            badgeProd.textContent = totalProd;
            badgeProd.style.display = totalProd > 0 ? '' : 'none';
        }

        // Badge de pedidos pendientes
        var badgePed = document.getElementById('badge-pedidos');
        if (badgePed) {
            var pedidos = (typeof window.DStore !== 'undefined' && window.DStore.getPedidos) ? window.DStore.getPedidos() : [];
            var pendientes = (Array.isArray(pedidos) ? pedidos.filter(function (p) {
                var est = (p && (p.status || p.estado) || '').toLowerCase();
                return est === 'pendiente';
            }) : []).length;
            badgePed.textContent = pendientes;
            badgePed.style.display = pendientes > 0 ? '' : 'none';
        }

        // Badge de solicitudes de servicios activas / pendientes
        var badgeSrv = document.getElementById('badge-servicios');
        if (badgeSrv) {
            var servicios = (typeof window.DStore !== 'undefined' && window.DStore.getServicios) ? window.DStore.getServicios() : [];
            var pendientesSrv = (Array.isArray(servicios) ? servicios.filter(function (s) {
                var est = (s && (s.status || s.estado) || '').toLowerCase();
                return est === 'pendiente' || est === 'confirmado' || est === 'activo';
            }) : []).length;
            badgeSrv.textContent = pendientesSrv;
            badgeSrv.style.display = pendientesSrv > 0 ? '' : 'none';
        }

        // Badge de mensajes no leídos
        var badgeMsg = document.getElementById('badge-mensajes');
        if (badgeMsg) {
            var msgs = getMensajes();
            var noLeidos = (Array.isArray(msgs) ? msgs.filter(function (m) { return m && !m.leido; }) : []).length;
            badgeMsg.textContent = noLeidos;
            badgeMsg.style.display = noLeidos > 0 ? '' : 'none';
        }

        // Badge de total de usuarios registrados
        var badgeUsr = document.getElementById('badge-usuarios');
        if (badgeUsr) {
            var usuarios = getUsuarios();
            var totalUsr = Array.isArray(usuarios) ? usuarios.length : 0;
            badgeUsr.textContent = totalUsr;
            badgeUsr.style.display = totalUsr > 0 ? '' : 'none';
        }
    }

    return { renderMenu, marcarActivo, toggle, configurarEventos, actualizarBadges, abrirMovil, cerrarMovil };
})();

// ── MENSAJES (Formulario de contacto / Soporte) ──────────────────────────────
var KEYS_MSG = 'prana_messages';

export function getMensajes() {
    try {
        var raw = localStorage.getItem(KEYS_MSG);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

export function setMensajes(m) {
    try {
        localStorage.setItem(KEYS_MSG, JSON.stringify(Array.isArray(m) ? m : []));
    } catch (e) {}
}

export function marcarMensajeLeido(id) {
    var lista = getMensajes();
    var idx   = lista.findIndex(function(m) { return m.id === id; });
    if (idx >= 0) lista[idx].leido = true;
    setMensajes(lista);
}

export function marcarTodosLeidos() {
    setMensajes(getMensajes().map(function(m) { m.leido = true; return m; }));
    renderMensajesAdmin();
    DSidebar.actualizarBadges();
    DToast.ok('Todos los mensajes marcados como leídos.');
}

export function renderMensajesAdmin() {
    var el     = document.getElementById('admin-mensajes-list');
    var badge  = document.getElementById('msg-no-leidos-badge');
    if (!el) return;

    var msgs     = getMensajes();
    var noLeidos = (Array.isArray(msgs) ? msgs.filter(function (m) { return m && !m.leido; }) : []).length;

    if (badge) badge.textContent = noLeidos + ' nuevo' + (noLeidos !== 1 ? 's' : '');

    if (msgs.length === 0) {
        el.innerHTML = vacio('ri-mail-open-line', 'Bandeja vacía', 'No hay mensajes recibidos.');
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

    el.querySelectorAll('.d-msg-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            if (e.target.closest('.d-msg-item__actions')) return;
            var id = item.dataset.msgId;
            marcarMensajeLeido(id);
            renderMensajesAdmin();
            DSidebar.actualizarBadges();
        });
    });
}

export function marcarLeido(id) {
    marcarMensajeLeido(id);
    renderMensajesAdmin();
    DSidebar.actualizarBadges();
    DToast.ok('Mensaje marcado como leído.');
}

// ── USUARIOS ADMIN (Gestión 100% Supabase) ───────────────────────────────────
var _usuariosCache = [];
var _sincronizandoUsuarios = false;

export function getUsuarios() {
    try {
        var raw = localStorage.getItem('prana_usuarios');
        if (raw) {
            var p = JSON.parse(raw);
            if (Array.isArray(p)) _usuariosCache = p;
        }
    } catch (e) {}

    if (typeof window !== 'undefined' && window.supabaseClient && !_sincronizandoUsuarios) {
        _sincronizandoUsuarios = true;
        window.supabaseClient
            .from('users')
            .select('*')
            .order('created_at', { ascending: false })
            .then(function (res) {
                _sincronizandoUsuarios = false;
                if (res && !res.error && Array.isArray(res.data)) {
                    _usuariosCache = res.data.map(function (u) {
                        return {
                            id: u.id,
                            nombre: u.name,
                            email: u.email,
                            role: u.role || 'cliente',
                            creadoEn: u.created_at
                        };
                    });
                    try { localStorage.setItem('prana_usuarios', JSON.stringify(_usuariosCache)); } catch (e) {}
                }
            })
            .catch(function (e) {
                _sincronizandoUsuarios = false;
                console.warn('[dashboard-common] Error al sincronizar usuarios de Supabase:', e);
            });
    }

    return Array.isArray(_usuariosCache) ? _usuariosCache : [];
}

export async function actualizarUsuario(uid, cambios) {
    var supabase = await obtenerClienteSupabase();
    if (!supabase) {
        throw new Error('Supabase client no está inicializado');
    }

    var usuarioActualizado = {};
    if (typeof cambios.nombre === 'string' && cambios.nombre.trim()) {
        usuarioActualizado.name = cambios.nombre.trim();
    }
    if (typeof cambios.email === 'string' && cambios.email.trim()) {
        usuarioActualizado.email = cambios.email.trim().toLowerCase();
    }
    if (cambios.role === 'admin' || cambios.role === 'cliente') {
        usuarioActualizado.role = cambios.role;
    }
    if (cambios.hash && cambios.salt) {
        usuarioActualizado.password_hash = cambios.hash;
        usuarioActualizado.salt = cambios.salt;
    }

    try {
        var { error } = await supabase
            .from('users')
            .update(usuarioActualizado)
            .eq('id', uid);

        if (error) {
            throw new Error('Error al actualizar usuario: ' + error.message);
        }

        // Actualizar caché
        var idx = _usuariosCache.findIndex(function(u) { return String(u.id) === String(uid); });
        if (idx >= 0) {
            if (usuarioActualizado.name) _usuariosCache[idx].nombre = usuarioActualizado.name;
            if (usuarioActualizado.email) _usuariosCache[idx].email = usuarioActualizado.email;
            if (usuarioActualizado.role) _usuariosCache[idx].role = usuarioActualizado.role;
            try { localStorage.setItem('prana_usuarios', JSON.stringify(_usuariosCache)); } catch (e) {}
        }

        return true;
    } catch (e) {
        console.error('[dashboard-common] Error al actualizar usuario:', e);
        throw e;
    }
}

export async function eliminarUsuario(uid, uidActivo) {
    if (uid === uidActivo) {
        throw new Error('No puedes eliminar tu propio usuario');
    }

    var supabase = await obtenerClienteSupabase();
    if (!supabase) {
        throw new Error('Supabase client no está inicializado');
    }

    try {
        var { error } = await supabase
            .from('users')
            .delete()
            .eq('id', uid);

        if (error) {
            throw new Error('Error al eliminar usuario: ' + error.message);
        }

        _usuariosCache = _usuariosCache.filter(function(u) { return String(u.id) !== String(uid); });
        try { localStorage.setItem('prana_usuarios', JSON.stringify(_usuariosCache)); } catch (e) {}

        return true;
    } catch (e) {
        console.error('[dashboard-common] Error al eliminar usuario:', e);
        throw e;
    }
}

export function renderUsuariosAdmin() {
    var tbody = document.getElementById('admin-usuarios-tbody');
    var total = document.getElementById('admin-usuarios-total');
    if (!tbody) return;

    var usuarios = getUsuarios();
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

export function abrirModalEditarUsuario(uid) {
    var usuarios = getUsuarios();
    var u = usuarios.find(function (x) { return x && String(x.id) === String(uid); });
    if (!u) return;

    var setVal = function(id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('edit-usr-id',     u.id);
    setVal('edit-usr-nombre', u.nombre);
    setVal('edit-usr-email',  u.email);
    setVal('edit-usr-pwd',    '');
    setVal('edit-usr-pwd2',   '');

    var rolSel = document.getElementById('edit-usr-rol');
    if (rolSel) rolSel.value = u.role === 'admin' ? 'admin' : 'cliente';

    var titulo = document.getElementById('modal-usr-titulo');
    if (titulo) titulo.textContent = 'Editar: ' + u.nombre;

    var overlay = document.getElementById('modal-usr-overlay');
    if (overlay) {
        overlay.classList.add('d-modal--visible');
        overlay.setAttribute('aria-hidden', 'false');
        var primerInput = document.getElementById('edit-usr-nombre');
        if (primerInput) setTimeout(function() { primerInput.focus(); }, 200);
    }
}

export function cerrarModalEditarUsuario() {
    var overlay = document.getElementById('modal-usr-overlay');
    if (overlay) {
        overlay.classList.remove('d-modal--visible');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

export async function eliminarUsuarioUI(uid) {
    var usuarios = getUsuarios();
    var u = usuarios.find(function (x) { return x && String(x.id) === String(uid); });
    if (!u) return;
    if (!confirm('¿Eliminar al usuario "' + u.nombre + '"? Esta acción no se puede deshacer.')) return;

    var sesion = JSON.parse(localStorage.getItem('prana_sesion') || '{}');
    var uidActivo = (sesion.usuario && sesion.usuario.id) ? sesion.usuario.id : '';

    try {
        await eliminarUsuario(uid, uidActivo);
        renderUsuariosAdmin();
        DSidebar.actualizarBadges();
        DToast.ok('Usuario eliminado.');
    } catch (e) {
        DToast.error(e.message || 'No se puede eliminar este usuario.');
    }
}

export function configurarFormEditarUsuario() {
    var form    = document.getElementById('form-edit-usuario');
    var overlay = document.getElementById('modal-usr-overlay');

    if (!form) return;

    if (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) cerrarModalEditarUsuario();
        });
    }
    var btnCancelar = document.getElementById('modal-usr-cancelar');
    if (btnCancelar) btnCancelar.addEventListener('click', cerrarModalEditarUsuario);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay && overlay.classList.contains('d-modal--visible')) {
            cerrarModalEditarUsuario();
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

        if (pwd || pwd2) {
            if (pwd.length < 6) { DToast.error('La contraseña debe tener al menos 6 caracteres.'); return; }
            if (pwd !== pwd2)   { DToast.error('Las contraseñas no coinciden.'); return; }

            try {
                if (typeof Hash !== 'undefined' && Hash.crearHash) {
                    var hashData = await Hash.crearHash(pwd);
                    cambios.hash = hashData.hash;
                    cambios.salt = hashData.salt;
                }
            } catch (err) {
                DToast.error('Error al procesar la contraseña.'); return;
            }
        }

        try {
            await actualizarUsuario(uid, cambios);
            cerrarModalEditarUsuario();
            renderUsuariosAdmin();
            DSidebar.actualizarBadges();
            DToast.ok('Usuario actualizado correctamente.');

            var sesion = JSON.parse(localStorage.getItem('prana_sesion') || '{}');
            if (sesion.usuario && sesion.usuario.id === uid && cambios.nombre) {
                var topbarNombre = document.getElementById('d-topbar-nombre');
                if (topbarNombre) topbarNombre.textContent = cambios.nombre.split(' ')[0];
            }
        } catch (e) {
            DToast.error('No se pudo actualizar el usuario.');
        }
    });
}

// ── PERFIL EXTENDIDO ────────────────────────────────────────────────────────
export function getPerfil(uid) {
    try {
        var raw = localStorage.getItem('prana_perfil_' + uid);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

export function setPerfil(uid, datos) {
    try {
        var actual = getPerfil(uid);
        var nuevo = Object.assign({}, actual, datos);
        localStorage.setItem('prana_perfil_' + uid, JSON.stringify(nuevo));
        return nuevo;
    } catch (e) {
        return datos || {};
    }
}

export function cargarPerfil(usuario) {
    if (!usuario || !usuario.id) return;
    var perfil = getPerfil(usuario.id);
    var set = function(id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; };

    set('perfil-nombre',      perfil.nombre    || usuario.nombre || '');
    set('perfil-email',       usuario.email || '');
    set('perfil-telefono',    perfil.telefono || '');
    set('perfil-ciudad',      perfil.ciudad || '');
    set('perfil-direccion',   perfil.direccion || '');
    set('fitness-objetivo',   perfil.fitnesObjetivo   || '');
    set('fitness-frecuencia', perfil.fitnesFrecuencia || '');
}

export function configurarFormPerfil(getUsuarioFn) {
    var form = document.getElementById('form-perfil');
    if (!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var usuario = getUsuarioFn ? getUsuarioFn() : null;
        if (!usuario || !usuario.id) return;

        var datos = {
            nombre:    document.getElementById('perfil-nombre').value.trim(),
            telefono:  document.getElementById('perfil-telefono').value.trim(),
            ciudad:    document.getElementById('perfil-ciudad').value.trim(),
            direccion: document.getElementById('perfil-direccion').value.trim()
        };
        if (!datos.nombre) { DToast.error('El nombre es obligatorio.'); return; }

        setPerfil(usuario.id, datos);
        DToast.ok('Perfil actualizado exitosamente.');

        usuario.nombre = datos.nombre;
        var el = document.getElementById('d-topbar-nombre');
        if (el) el.textContent = datos.nombre.split(' ')[0];
    });
}

export function configurarFormPassword(getUsuarioFn) {
    var form = document.getElementById('form-password');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var usuario = getUsuarioFn ? getUsuarioFn() : null;
        if (!usuario || !usuario.id) return;

        var actual    = document.getElementById('pwd-actual').value;
        var nueva     = document.getElementById('pwd-nueva').value;
        var confirmar = document.getElementById('pwd-confirmar').value;

        if (!actual || !nueva || !confirmar) { DToast.error('Completa todos los campos.'); return; }
        if (nueva.length < 6) { DToast.error('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
        if (nueva !== confirmar) { DToast.error('Las contraseñas no coinciden.'); return; }

        try {
            var usuarios = JSON.parse(localStorage.getItem('prana_usuarios') || '[]');
            var userDB   = usuarios.find(function(u){ return u.id === usuario.id; });
            if (!userDB) { DToast.error('Usuario no encontrado.'); return; }

            if (typeof Hash !== 'undefined') {
                var ok = await Hash.verificarPassword(actual, userDB.salt, userDB.hash);
                if (!ok) { DToast.error('La contraseña actual es incorrecta.'); return; }

                var hashData = await Hash.crearHash(nueva);
                userDB.salt  = hashData.salt;
                userDB.hash  = hashData.hash;
                localStorage.setItem('prana_usuarios', JSON.stringify(usuarios));
                form.reset();
                DToast.ok('Contraseña actualizada correctamente.');
            }
        } catch (err) {
            DToast.error('Error al actualizar la contraseña.');
        }
    });
}

export function configurarFormFitness(getUsuarioFn) {
    var form = document.getElementById('form-fitness');
    if (!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var usuario = getUsuarioFn ? getUsuarioFn() : null;
        if (!usuario || !usuario.id) return;

        setPerfil(usuario.id, {
            fitnesObjetivo:   document.getElementById('fitness-objetivo').value,
            fitnesFrecuencia: document.getElementById('fitness-frecuencia').value
        });
        DToast.ok('Objetivo fitness guardado.');
    });
}
