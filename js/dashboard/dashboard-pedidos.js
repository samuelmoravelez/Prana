/**
 * js/dashboard/dashboard-pedidos.js
 * Tabla de pedidos de la tienda (`orders`), actualización de estados,
 * exportación a CSV, detalle y seguimiento para clientes.
 */

import {
    obtenerClienteSupabase,
    esc,
    formatoCOP,
    formatoFecha,
    badgeEstado,
    avatarIniciales,
    vacio,
    DToast,
    DSidebar,
    getUsuarios
} from './dashboard-common.js';
import { renderKpis } from './dashboard-kpis.js';

var KEYS_PEDIDOS = 'prana_orders';
var _pedidosCache = [];
var _sincronizandoPedidos = false;

// Inicialización de caché
try {
    var rawInicial = localStorage.getItem(KEYS_PEDIDOS);
    if (rawInicial) {
        var parsed = JSON.parse(rawInicial);
        if (Array.isArray(parsed)) _pedidosCache = parsed;
    }
} catch (e) {
    _pedidosCache = [];
}

/**
 * Obtiene la lista de pedidos en memoria / caché y sincroniza en segundo plano con Supabase.
 * @returns {Array}
 */
export function getPedidos() {
    try {
        var raw = localStorage.getItem(KEYS_PEDIDOS);
        if (raw) {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) _pedidosCache = parsed;
        }
    } catch (e) {}

    if (typeof window !== 'undefined' && window.supabaseClient && !_sincronizandoPedidos) {
        _sincronizandoPedidos = true;
        window.supabaseClient
            .from('orders')
            .select('*, users(name, email)')
            .order('created_at', { ascending: false })
            .then(function (res) {
                _sincronizandoPedidos = false;
                if (res && !res.error && Array.isArray(res.data)) {
                    var usuarios = getUsuarios();
                    _pedidosCache = res.data.map(function (p) {
                        var u = p.users || (Array.isArray(usuarios) ? usuarios.find(function (usr) { return String(usr.id) === String(p.user_id); }) : null);
                        var clienteNom = u ? (u.name || u.nombre) : (p.user_name || p.cliente_nombre || 'Cliente');
                        var clienteMail = u ? u.email : (p.cliente_email || '');
                        var tot = Number(p.total_amount !== undefined ? p.total_amount : p.total) || 0;
                        var prodsStr = Array.isArray(p.items) 
                            ? p.items.map(function (it) { return (it.nombre || it.name || 'Producto') + ' × ' + (it.cantidad || 1); }).join(' · ') 
                            : (p.productos || '');

                        return {
                            id: p.id,
                            userId: p.user_id,
                            clienteNombre: clienteNom,
                            clienteEmail: clienteMail,
                            items: p.items || [],
                            productos: prodsStr,
                            total: tot,
                            total_amount: tot,
                            estado: p.status || p.estado || 'pendiente',
                            status: p.status || p.estado || 'pendiente',
                            fecha: p.created_at,
                            created_at: p.created_at,
                            updatedAt: p.updated_at
                        };
                    });
                    try {
                        localStorage.setItem(KEYS_PEDIDOS, JSON.stringify(_pedidosCache));
                    } catch (e) {}
                }
            })
            .catch(function (err) {
                _sincronizandoPedidos = false;
                console.warn('[dashboard-pedidos] Aviso al sincronizar pedidos de Supabase:', err);
            });
    }

    return Array.isArray(_pedidosCache) ? _pedidosCache : [];
}

export function setPedidos(p) {
    var arr = Array.isArray(p) ? p : [];
    _pedidosCache = arr;
    try {
        localStorage.setItem(KEYS_PEDIDOS, JSON.stringify(arr));
    } catch (e) {}
}

export function getPedidosDeUsuario(uid) {
    var pedidos = getPedidos();
    if (!Array.isArray(pedidos)) return [];
    return pedidos.filter(function (p) {
        return p && String(p.userId) === String(uid);
    });
}

export async function actualizarEstadoPedido(id, estado) {
    var lista = getPedidos();
    if (!Array.isArray(lista)) lista = [];
    var idx = lista.findIndex(function (p) { return p && String(p.id) === String(id); });
    if (idx >= 0) {
        lista[idx].estado = estado;
        lista[idx].status = estado;
        lista[idx].updatedAt = new Date().toISOString();
        setPedidos(lista);
    }

    var supabase = await obtenerClienteSupabase();
    if (supabase) {
        try {
            await supabase
                .from('orders')
                .update({ status: estado })
                .eq('id', id);
        } catch (e) {
            console.error('[dashboard-pedidos] Error al actualizar estado de pedido en Supabase:', e);
        }
    }
    return true;
}

// ── RENDER TABLA PEDIDOS (ADMIN) ─────────────────────────────────────────────
export async function renderTablaPedidos() {
    var tbody = document.getElementById('admin-pedidos-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Cargando pedidos...</span></div></td></tr>';

    var pedidos = [];
    try {
        var supabase = await obtenerClienteSupabase();
        if (supabase) {
            var res = await supabase
                .from('orders')
                .select('*, users(name, email)')
                .order('created_at', { ascending: false });

            if (res && !res.error && Array.isArray(res.data)) {
                pedidos = res.data;
            } else {
                var ordersRes = await supabase
                    .from('orders')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (ordersRes && !ordersRes.error && Array.isArray(ordersRes.data)) {
                    pedidos = ordersRes.data;
                    try {
                        var usersRes = await supabase.from('users').select('*');
                        if (usersRes && !usersRes.error && Array.isArray(usersRes.data)) {
                            var userMap = {};
                            usersRes.data.forEach(function (u) { userMap[String(u.id)] = u; });
                            pedidos.forEach(function (p) {
                                p.users = userMap[String(p.user_id)] || null;
                            });
                        }
                    } catch (uErr) {}
                }
            }
        }
    } catch (err) {
        console.error('[dashboard-pedidos] Error al consultar pedidos de Supabase:', err);
    }

    if (pedidos.length === 0) {
        var pedidosRaw = getPedidos();
        if (Array.isArray(pedidosRaw) && pedidosRaw.length > 0) pedidos = pedidosRaw;
    }

    if (!Array.isArray(pedidos) || pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">' + vacio('ri-shopping-bag-line', 'Sin pedidos', 'Aún no hay pedidos registrados.') + '</td></tr>';
        return;
    }

    var ESTADOS = ['pendiente', 'enviado', 'completado', 'cancelado'];
    var ESTADO_LABELS = {
        pendiente: 'Pendiente',
        enviado: 'Enviado',
        completado: 'Completado',
        cancelado: 'Cancelado'
    };

    tbody.innerHTML = pedidos.map(function (p) {
        var userObj = p.users || {};
        var clienteNom = userObj.name || userObj.nombre || p.clienteNombre || p.user_name || p.cliente_nombre || 'Cliente';
        var initials = avatarIniciales(clienteNom);
        var total = Number(p.total !== undefined ? p.total : p.total_amount) || 0;
        var estadoActual = p.status || p.estado || 'pendiente';

        var prodsStr = '';
        if (Array.isArray(p.items) && p.items.length > 0) {
            prodsStr = p.items.map(function (it) {
                return (it.nombre || it.name || 'Producto') + ' × ' + (it.cantidad || 1);
            }).join(' · ');
        } else {
            prodsStr = p.productos || 'Productos';
        }

        var selectOpts = ESTADOS.map(function (e) {
            return '<option value="' + e + '"' + (estadoActual === e ? ' selected' : '') + '>' +
                (ESTADO_LABELS[e] || e) +
                '</option>';
        }).join('');

        return '<tr>' +
            '<td><span class="d-table__id">' + esc(p.id) + '</span></td>' +
            '<td><div class="d-table__user">' +
            '<div class="d-table__avatar">' + initials + '</div>' +
            '<span>' + esc(clienteNom) + '</span></div></td>' +
            '<td class="d-table__hide-mobile" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(prodsStr) + '">' +
            esc(prodsStr) + '</td>' +
            '<td style="font-weight:700;font-family:var(--d-font-head);">' + formatoCOP(total) + '</td>' +
            '<td style="font-size:0.82rem;color:var(--d-texto-mut);white-space:nowrap;">' + formatoFecha(p.created_at || p.fecha) + '</td>' +
            '<td>' +
            '<select class="d-select-estado" data-pedido-id="' + esc(p.id) + '" aria-label="Estado del pedido ' + esc(p.id) + '">' +
            selectOpts + '</select></td>' +
            '<td><div class="d-action-btns">' +
            '<button class="d-btn-icon" title="Ver detalle" onclick="DRender.verDetallePedido(\'' + esc(p.id) + '\')">' +
            '<i class="ri-eye-line" aria-hidden="true"></i></button>' +
            '</div></td>' +
            '</tr>';
    }).join('');

    // Listener para cambios de estado en selects
    tbody.querySelectorAll('.d-select-estado').forEach(function (sel) {
        sel.addEventListener('change', async function () {
            var pedidoId = sel.dataset.pedidoId;
            var nuevoEstado = sel.value;
            try {
                await actualizarEstadoPedido(pedidoId, nuevoEstado);
                DSidebar.actualizarBadges();
                await renderKpis();
                DToast.ok('Estado del pedido ' + pedidoId + ' actualizado.');
            } catch (e) {
                console.error('[dashboard-pedidos] Error al actualizar estado pedido:', e);
                DToast.error('No se pudo actualizar el estado del pedido.');
            }
        });
    });
}

export function verDetallePedido(id) {
    var pedidos = getPedidos();
    var p = Array.isArray(pedidos) ? pedidos.find(function (x) { return x && String(x.id) === String(id); }) : null;
    if (!p) return;
    DToast.info('Pedido ' + id + ' | ' + (p.clienteNombre || 'Cliente') + ' | ' + formatoCOP(p.total) + ' | ' + (p.estado || p.status));
}

export function exportarPedidosCSV() {
    var pedidos = getPedidos();
    if (!pedidos.length) {
        DToast.error('No hay pedidos para exportar.');
        return;
    }

    var csv = 'ID,Cliente,Productos,Total,Estado,Fecha\n';
    pedidos.forEach(function (p) {
        if (!p) return;
        csv += [
            p.id,
            '"' + (p.clienteNombre || '') + '"',
            '"' + (p.productos || '') + '"',
            p.total || p.total_amount || 0,
            p.estado || p.status || '',
            p.created_at || p.fecha || ''
        ].join(',') + '\n';
    });

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'prana_pedidos_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    DToast.ok('Pedidos exportados como CSV.');
}

// ── RENDER CLIENTE: Mis Pedidos ──────────────────────────────────────────────
export async function renderPedidosCliente(usuario) {
    var el = document.getElementById('cliente-pedidos-contenedor');
    if (!el) return;

    var usuarioActual = usuario || (typeof AuthService !== 'undefined' && AuthService.getCurrentUser ? AuthService.getCurrentUser() : null);
    if (!usuarioActual && typeof window.Dashboard !== 'undefined' && window.Dashboard.getUsuario) {
        usuarioActual = window.Dashboard.getUsuario();
    }
    if (!usuarioActual || !usuarioActual.id) {
        el.innerHTML = '<div class="d-card"><div class="d-card__body">' +
            vacio('ri-user-unfollow-line', 'Sesión no iniciada', 'Inicia sesión para ver tus pedidos.') +
            '</div></div>';
        return;
    }

    el.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-success" role="status"></div></div>';

    var pedidos = [];
    try {
        var supabase = await obtenerClienteSupabase();
        if (supabase) {
            var res = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', usuarioActual.id)
                .order('created_at', { ascending: false });
            if (res && !res.error && Array.isArray(res.data)) {
                pedidos = res.data;
            }
        }
    } catch (e) {
        console.warn('[dashboard-pedidos] Error al consultar pedidos del cliente en Supabase:', e);
    }

    if (pedidos.length === 0) {
        var pedidosRaw = getPedidosDeUsuario(usuarioActual.id);
        if (Array.isArray(pedidosRaw) && pedidosRaw.length > 0) pedidos = pedidosRaw;
    }

    if (!Array.isArray(pedidos) || pedidos.length === 0) {
        el.innerHTML = '<div class="d-card"><div class="d-card__body">' +
            vacio('ri-shopping-bag-line', 'Sin pedidos', 'Aún no has realizado ningún pedido.') +
            '</div></div>';
        return;
    }

    el.innerHTML = pedidos.map(function (p) {
        var estado = p.status || p.estado || 'pendiente';
        var total = Number(p.total !== undefined ? p.total : p.total_amount) || 0;
        var fecha = p.created_at || p.fecha;

        var prodsStr = '';
        if (Array.isArray(p.items) && p.items.length > 0) {
            prodsStr = p.items.map(function (it) {
                return (it.nombre || it.name || 'Producto') + ' × ' + (it.cantidad || 1);
            }).join(' · ');
        } else {
            prodsStr = p.productos || 'Productos';
        }

        var PASOS = [
            { key: 'pendiente',  label: 'Pedido recibido', desc: 'Tu pedido ha sido registrado.' },
            { key: 'enviado',    label: 'En camino',       desc: 'Tu pedido fue despachado.' },
            { key: 'completado', label: 'Entregado',       desc: '¡Tu pedido llegó exitosamente!' }
        ];

        var orden = ['pendiente', 'enviado', 'completado'];
        var idx   = orden.indexOf(estado);

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
            badgeEstado(estado) +
            '<span style="font-family:var(--d-font-head);font-weight:800;color:var(--d-vino);">' + formatoCOP(total) + '</span>' +
            '</div></div>' +
            '<div class="d-card__body">' +
            '<div style="margin-bottom:16px;">' +
            '<p style="font-size:0.82rem;color:var(--d-texto-mut);margin-bottom:4px;">Productos</p>' +
            '<p style="font-size:0.88rem;font-weight:500;">' + esc(prodsStr) + '</p>' +
            '<p style="font-size:0.78rem;color:var(--d-texto-mut);margin-top:4px;">Fecha: ' + formatoFecha(fecha) + '</p>' +
            '</div>' +
            timelineHtml +
            '</div></div>';
    }).join('');
}
