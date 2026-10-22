/**
 * js/dashboard/dashboard-main.js
 * Punto de entrada principal y orquestador del Dashboard Prana Fitness.
 * Inicializa el DOM, enrutamiento por hash, eventos del sidebar, formularios y
 * expone los namespaces globales en window (Dashboard, DRender, DToast, DSidebar, DCharts, DStore).
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
    DCharts,
    DSidebar,
    getUsuarios,
    actualizarUsuario,
    eliminarUsuario,
    renderUsuariosAdmin,
    abrirModalEditarUsuario,
    cerrarModalEditarUsuario,
    eliminarUsuarioUI,
    configurarFormEditarUsuario,
    getMensajes,
    setMensajes,
    marcarMensajeLeido,
    marcarTodosLeidos,
    renderMensajesAdmin,
    marcarLeido,
    getPerfil,
    setPerfil,
    cargarPerfil,
    configurarFormPerfil,
    configurarFormPassword,
    configurarFormFitness
} from './dashboard-common.js';

import {
    verificarSesion,
    obtenerRol,
    construirTopbar,
    cerrarSesion
} from './dashboard-auth.js';

import {
    renderKpis,
    renderGraficos
} from './dashboard-kpis.js';

import {
    getProductos,
    guardarProducto,
    eliminarProducto,
    renderProductosAdmin,
    setFiltroProductos,
    abrirModalProducto,
    cerrarModalProducto,
    eliminarProductoUI,
    configurarFormProducto
} from './dashboard-productos.js';

import {
    getCatalogoServicios,
    setCatalogoServicios,
    guardarServicioCatalogo,
    eliminarServicioCatalogo,
    getServicios,
    setServicios,
    getServiciosDeUsuario,
    actualizarEstadoServicio,
    actualizarNotaServicio,
    renderTablaServiciosCatalog,
    cargarCatalogoServicios,
    renderSolicitudesServiciosAdmin,
    renderServiciosAdmin,
    editarNotaServicio,
    abrirModalServicio,
    cerrarModalServicio,
    eliminarServicioCatalogoUI,
    renderServiciosCliente,
    configurarFormServicio
} from './dashboard-servicios.js';

import {
    getPedidos,
    setPedidos,
    getPedidosDeUsuario,
    actualizarEstadoPedido,
    renderTablaPedidos,
    verDetallePedido,
    exportarPedidosCSV,
    renderPedidosCliente
} from './dashboard-pedidos.js';

import {
    getBlog,
    setBlog,
    crearPost,
    actualizarPost,
    eliminarPost,
    renderBlogAdmin,
    renderTablaBlogAdmin,
    editarPost,
    eliminarPostUI,
    configurarFormBlog
} from './dashboard-blog.js';

import {
    getFavoritos,
    toggleFavorito,
    renderFavoritos,
    quitarFavorito,
    agregarFavoritoAlCarrito
} from './dashboard-favoritos.js';

// ── Objeto DStore para compatibilidad global ─────────────────────────────────
export var DStore = {
    getProductos, guardarProducto, eliminarProducto,
    getPedidos, setPedidos, getPedidosDeUsuario, actualizarEstadoPedido,
    getServicios, setServicios, getServiciosDeUsuario, actualizarEstadoServicio, actualizarNotaServicio,
    getCatalogoServicios, setCatalogoServicios, guardarServicioCatalogo, eliminarServicioCatalogo,
    getBlog, setBlog, crearPost, actualizarPost, eliminarPost,
    getMensajes, setMensajes, marcarMensajeLeido, marcarTodosLeidos,
    getPerfil, setPerfil, getFavoritos, toggleFavorito,
    getUsuarios, actualizarUsuario, eliminarUsuario
};

// ── Objeto DRender para renderizado y llamadas onclick desde HTML ────────────
export var DRender = {
    renderKpis,
    renderKPIs: renderKpis,
    actualizarEstadisticas: renderKpis,
    renderGraficos,
    // Pedidos
    renderTablaPedidos,
    verDetallePedido,
    renderPedidosCliente,
    // Productos admin
    renderProductosAdmin,
    setFiltroProductos,
    abrirModalProducto,
    cerrarModalProducto,
    eliminarProductoUI,
    // Servicios admin y cliente
    renderServiciosAdmin,
    renderTablaServiciosCatalog,
    cargarCatalogoServicios,
    renderSolicitudesServiciosAdmin,
    renderServiciosCliente,
    abrirModalServicio,
    cerrarModalServicio,
    eliminarServicioCatalogoUI,
    editarNotaServicio,
    // Blog admin
    renderBlogAdmin,
    renderTablaBlogAdmin,
    editarPost,
    eliminarPostUI,
    // Mensajes admin
    renderMensajesAdmin,
    marcarLeido,
    // Favoritos cliente
    renderFavoritos,
    quitarFavorito,
    agregarFavoritoAlCarrito,
    // Usuarios admin
    renderUsuariosAdmin,
    abrirModalEditarUsuario,
    cerrarModalEditarUsuario,
    eliminarUsuarioUI,
    // Perfil cliente
    cargarPerfil,
    // Utilidades
    formatoCOP,
    formatoFecha,
    esc,
    vacio,
    badgeEstado,
    avatarIniciales
};

// ── Orquestador Principal Dashboard ──────────────────────────────────────────
export var Dashboard = (function () {
    'use strict';

    var _usuario   = null;
    var _rol       = 'cliente';
    var _seccionId = '';

    var RENDERS = {
        'sec-admin-resumen':   async function () {
            await renderKpis();
            renderGraficos();
        },
        'sec-admin-productos': function () { renderProductosAdmin(); },
        'sec-admin-pedidos':   async function () { await renderTablaPedidos(); },
        'sec-admin-servicios': async function () { await renderServiciosAdmin(); },
        'sec-admin-usuarios':  function () { renderUsuariosAdmin(); },
        'sec-admin-blog':      async function () { await renderBlogAdmin(); },
        'sec-admin-mensajes':  function () { renderMensajesAdmin(); },

        'sec-cliente-pedidos':   async function () { await renderPedidosCliente(_usuario); },
        'sec-cliente-servicios': async function () { await renderServiciosCliente(_usuario); },
        'sec-cliente-favoritos': async function () { await renderFavoritos(_usuario); },
        'sec-cliente-perfil':    function () { cargarPerfil(_usuario); }
    };

    function init() {
        setTimeout(function () {
            _usuario = verificarSesion();
            if (!_usuario) return;

            _rol = obtenerRol(_usuario);

            // Construir UI
            construirTopbar(_usuario, _rol);
            DSidebar.renderMenu(_rol);
            DSidebar.configurarEventos();
            DSidebar.actualizarBadges();

            // Configurar Formularios
            _configurarTodosLosFormularios();

            // Mostrar Layout y ocultar Loader
            var layout = document.getElementById('d-layout');
            var loader = document.getElementById('d-loading');
            if (layout) layout.style.display = 'flex';
            if (loader) {
                loader.classList.add('oculto');
                setTimeout(function () { loader.style.display = 'none'; }, 450);
            }

            // Listeners de búsqueda y filtrado de productos
            var prodBuscarInput = document.getElementById('admin-prod-buscar');
            var prodCatSelect   = document.getElementById('admin-prod-filtro-cat');
            if (prodBuscarInput) {
                prodBuscarInput.addEventListener('input', function () {
                    setFiltroProductos(prodBuscarInput.value, prodCatSelect ? prodCatSelect.value : '');
                });
            }
            if (prodCatSelect) {
                prodCatSelect.addEventListener('change', function () {
                    setFiltroProductos(prodBuscarInput ? prodBuscarInput.value : '', prodCatSelect.value);
                });
            }

            // Sección inicial respetando hash
            var hash = (window.location.hash || '').replace('#', '');
            var primeraSeccion = _rol === 'admin' ? 'sec-admin-resumen' : 'sec-cliente-pedidos';
            var seccionInicial = (hash && document.getElementById(hash)) ? hash : primeraSeccion;
            irA(seccionInicial);

            // Evento hashchange
            window.addEventListener('hashchange', function () {
                var nuevoHash = (window.location.hash || '').replace('#', '');
                if (nuevoHash && document.getElementById(nuevoHash)) {
                    irA(nuevoHash);
                }
            });

        }, 400);
    }

    function _configurarTodosLosFormularios() {
        configurarFormProducto();
        configurarFormServicio();
        configurarFormBlog(function () { return _usuario; });
        configurarFormPerfil(function () { return _usuario; });
        configurarFormPassword(function () { return _usuario; });
        configurarFormFitness(function () { return _usuario; });
        configurarFormEditarUsuario();
    }

    function irA(seccionId) {
        var seccionEl = document.getElementById(seccionId);
        if (!seccionEl) return;

        var rolRequerido = seccionEl.getAttribute('data-rol');
        if (rolRequerido && rolRequerido !== _rol) {
            var fallback = _rol === 'admin' ? 'sec-admin-resumen' : 'sec-cliente-pedidos';
            if (seccionId !== fallback) irA(fallback);
            return;
        }

        document.querySelectorAll('.d-section').forEach(function (s) {
            s.classList.remove('activo');
        });

        seccionEl.classList.add('activo');
        _seccionId = seccionId;

        DSidebar.marcarActivo(seccionId);

        if (RENDERS[seccionId]) {
            try {
                RENDERS[seccionId]();
            } catch (err) {
                console.error('[Dashboard] Error al renderizar sección "' + seccionId + '":', err);
                DToast.error('Error al cargar la sección. Por favor recarga la página.');
            }
        }

        DSidebar.actualizarBadges();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderSeccionActual() {
        if (_seccionId && RENDERS[_seccionId]) RENDERS[_seccionId]();
    }

    function cargarDatosSeed() {
        if (RENDERS[_seccionId]) RENDERS[_seccionId]();
        DSidebar.actualizarBadges();
        DToast.info('Datos recargados.');
    }

    return {
        init,
        irA,
        renderSeccionActual,
        cargarDatosSeed,
        marcarTodosLeidos,
        exportarPedidosCSV,
        cerrarSesion,
        getUsuario: function () { return _usuario; },
        getRol: function () { return _rol; }
    };
})();

// ── EXPOSICIÓN GLOBAL EN WINDOW (100% Backwards Compatible) ──────────────────
if (typeof window !== 'undefined') {
    window.Dashboard = Dashboard;
    window.DRender   = DRender;
    window.DToast    = DToast;
    window.DSidebar  = DSidebar;
    window.DCharts   = DCharts;
    window.DStore    = DStore;
}

// ── Iniciar cuando el DOM esté listo ────────────────────────────────────────
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', Dashboard.init);
    } else {
        Dashboard.init();
    }
}
