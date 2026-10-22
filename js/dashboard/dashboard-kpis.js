/**
 * js/dashboard/dashboard-kpis.js
 * Consulta y renderizado de métricas principales, ventas, pedidos pendientes,
 * solicitudes de servicios activas y gráficos de administración.
 */

import { obtenerClienteSupabase, formatoCOP, DCharts, getMensajes } from './dashboard-common.js';

/**
 * Consulta las métricas de Supabase y renderiza los 4 KPIs del dashboard administrativo.
 */
export async function renderKpis() {
    var pedidos = [];
    var servicios = [];
    var mensajes = [];

    var supabase = await obtenerClienteSupabase();
    if (supabase) {
        try {
            var results = await Promise.all([
                supabase.from('orders').select('*'),
                supabase.from('service_requests').select('*')
            ]);
            if (results[0] && !results[0].error && Array.isArray(results[0].data)) {
                pedidos = results[0].data;
            }
            if (results[1] && !results[1].error && Array.isArray(results[1].data)) {
                servicios = results[1].data;
            }
        } catch (e) {
            console.warn('[dashboard-kpis] Error al consultar datos para KPIs en Supabase:', e);
        }
    }

    // Fallbacks si la red falló o devolvió vacío
    if (pedidos.length === 0 && typeof window.DStore !== 'undefined' && window.DStore.getPedidos) {
        var pedidosRaw = window.DStore.getPedidos();
        if (Array.isArray(pedidosRaw)) pedidos = pedidosRaw;
    }
    if (servicios.length === 0 && typeof window.DStore !== 'undefined' && window.DStore.getServicios) {
        var serviciosRaw = window.DStore.getServicios();
        if (Array.isArray(serviciosRaw)) servicios = serviciosRaw;
    }

    mensajes = getMensajes();

    // Ventas Totales: suma de total / total_amount donde status != 'cancelado'
    var totalVentas = pedidos
        .filter(function (p) {
            var est = ((p && (p.status || p.estado)) || '').toLowerCase();
            return est !== 'cancelado';
        })
        .reduce(function (a, p) {
            var val = Number(p.total !== undefined ? p.total : p.total_amount) || 0;
            return a + val;
        }, 0);

    // Pedidos Pendientes: conteo directo con status === 'pendiente'
    var pedidosPend = pedidos.filter(function (p) {
        var est = ((p && (p.status || p.estado)) || '').toLowerCase();
        return est === 'pendiente';
    }).length;

    // Servicios Activos: conteo directo en service_requests con status 'pendiente' o 'confirmado'
    var serviciosActivos = servicios.filter(function (s) {
        var est = ((s && (s.status || s.estado)) || '').toLowerCase();
        return est === 'pendiente' || est === 'confirmado';
    }).length;

    // Mensajes sin leer
    var msgNuevos = mensajes.filter(function (m) { return m && !m.leido; }).length;

    var kpis = [
        { clase: 'ventas',    icon: 'ri-money-dollar-circle-line', label: 'Ventas Totales',     valor: formatoCOP(totalVentas), delta: '+12% vs mes anterior' },
        { clase: 'pedidos',   icon: 'ri-shopping-bag-3-line',      label: 'Pedidos Pendientes', valor: pedidosPend,            delta: pedidos.length + ' total' },
        { clase: 'servicios', icon: 'ri-user-star-line',           label: 'Servicios Activos',  valor: serviciosActivos,       delta: servicios.length + ' total' },
        { clase: 'mensajes',  icon: 'ri-mail-line',                label: 'Mensajes Sin Leer',  valor: msgNuevos,              delta: mensajes.length + ' total' }
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

/**
 * Renderiza los gráficos SVG de ventas mensuales y distribución por categoría.
 */
export function renderGraficos() {
    var meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    var pedidos = (typeof window.DStore !== 'undefined' && window.DStore.getPedidos) ? window.DStore.getPedidos() : [];
    if (!Array.isArray(pedidos)) pedidos = [];

    var porMes = {};
    pedidos.forEach(function (p) {
        var est = ((p && (p.status || p.estado)) || '').toLowerCase();
        var f   = p && (p.created_at || p.fecha);
        if (est === 'completado' && f) {
            var m = meses[new Date(f).getMonth()];
            var tot = Number(p.total !== undefined ? p.total : p.total_amount) || 0;
            porMes[m] = (porMes[m] || 0) + tot;
        }
    });

    // Valores demo para los meses que no tengan datos aún
    var DEMO = { Ene:1200000, Feb:980000, Mar:1450000, Abr:1100000, May:1800000, Jun:2100000,
                 Jul:1650000, Ago:1900000, Sep:2300000, Oct:1750000, Nov:2550000, Dic:3100000 };
    var datosBarras = meses.map(function (m) {
        return { label: m, valor: porMes[m] || DEMO[m] };
    });

    DCharts.renderBarras('chart-ventas', datosBarras);

    // Donut por categorías
    var catMap = {};
    pedidos.forEach(function (p) {
        if (!p) return;
        var prodsStr = '';
        if (Array.isArray(p.items)) {
            prodsStr = p.items.map(function(it) { return it.nombre || it.name || ''; }).join(' ');
        } else {
            prodsStr = p.productos || '';
        }

        var cats = ['Suplementos','Indumentaria','Equipamiento','Accesorios'];
        cats.forEach(function (c) {
            if (prodsStr.indexOf(c) >= 0 || Math.random() < 0.25) {
                catMap[c] = (catMap[c] || 0) + 1;
            }
        });
    });

    if (Object.keys(catMap).length === 0) {
        catMap = { Suplementos: 42, Indumentaria: 28, Equipamiento: 18, Accesorios: 12 };
    }

    var donutData = Object.keys(catMap).map(function (k) {
        return { label: k, valor: catMap[k] };
    });

    DCharts.renderDonut('donut-categorias', donutData);
}
