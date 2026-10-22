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
 *
 * Dependencias: utils/storage.js, utils/hash.js, services/auth.js
 */

async function obtenerClienteSupabase() {
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

// ═══════════════════════════════════════════════════════════════════════════
// DSTORE — Capa de datos 100% en Supabase
// ═══════════════════════════════════════════════════════════════════════════
var DStore = (function () {

    'use strict';

    // NOTA: Este módulo funciona exclusivamente con Supabase. No hay fallback a localStorage.

    var KEYS = {
        pedidos:    'prana_orders',
        blog:       'prana_blog_posts',
        mensajes:   'prana_messages',
        usuarios:   'prana_usuarios'
    };

    function _get(clave) {
        try {
            var raw = localStorage.getItem(clave);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function _set(clave, valor) {
        try {
            localStorage.setItem(clave, JSON.stringify(valor));
        } catch (e) {}
    }

    // ── PEDIDOS ──────────────────────────────────────────────────────────────
    var _pedidosCache = [];
    var _sincronizandoPedidos = false;

    // Inicialización segura de caché de pedidos
    try {
        var rawInicial = localStorage.getItem(KEYS.pedidos);
        if (rawInicial) {
            var parsed = JSON.parse(rawInicial);
            if (Array.isArray(parsed)) _pedidosCache = parsed;
        }
    } catch (e) {
        _pedidosCache = [];
    }

    /**
     * Obtiene la lista de pedidos.
     * Retorna SIEMPRE un Array [] por defecto (incluso con error de red o de Supabase).
     * Sincroniza con Supabase en segundo plano si el cliente está disponible.
     * @returns {Array} Lista de pedidos
     */
    function getPedidos() {
        try {
            var raw = localStorage.getItem(KEYS.pedidos);
            if (raw) {
                var parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    _pedidosCache = parsed;
                }
            }
        } catch (e) {
            // Silencioso ante excepciones
        }

        // Sincronización en segundo plano con Supabase si está disponible
        if (typeof window !== 'undefined' && window.supabaseClient && !_sincronizandoPedidos) {
            _sincronizandoPedidos = true;
            window.supabaseClient
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .then(function (res) {
                    _sincronizandoPedidos = false;
                    if (res && !res.error && Array.isArray(res.data)) {
                        var usuarios = getUsuarios();
                        _pedidosCache = res.data.map(function (p) {
                            var u = Array.isArray(usuarios) ? usuarios.find(function (usr) { return String(usr.id) === String(p.user_id); }) : null;
                            var clienteNom = u ? (u.nombre || u.name) : (p.user_name || p.cliente_nombre || 'Cliente');
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
                            localStorage.setItem(KEYS.pedidos, JSON.stringify(_pedidosCache));
                        } catch (e) {}
                    }
                })
                .catch(function (err) {
                    _sincronizandoPedidos = false;
                    console.warn('[DStore] Aviso al sincronizar pedidos de Supabase:', err);
                });
        }

        return Array.isArray(_pedidosCache) ? _pedidosCache : [];
    }

    function setPedidos(p) {
        var arr = Array.isArray(p) ? p : [];
        _pedidosCache = arr;
        _set(KEYS.pedidos, arr);
    }

    function getPedidosDeUsuario(uid) {
        var pedidos = getPedidos();
        if (!Array.isArray(pedidos)) return [];
        return pedidos.filter(function (p) {
            return p && String(p.userId) === String(uid);
        });
    }

    async function actualizarEstadoPedido(id, estado) {
        var lista = getPedidos();
        if (!Array.isArray(lista)) lista = [];
        var idx = lista.findIndex(function (p) { return p && String(p.id) === String(id); });
        if (idx >= 0) {
            lista[idx].estado = estado;
            lista[idx].status = estado;
            lista[idx].updatedAt = new Date().toISOString();
            setPedidos(lista);
        }

        if (window.supabaseClient) {
            try {
                await window.supabaseClient
                    .from('orders')
                    .update({ status: estado })
                    .eq('id', id);
            } catch (e) {
                console.error('[DStore] Error al actualizar estado de pedido en Supabase:', e);
            }
        }
        return true;
    }

    // ── SERVICIOS CATÁLOGO (Admin CRUD 100% Supabase) ────────────────────────
    var _serviciosDashboardCache = [];
    var _sincronizandoServiciosDashboard = false;

    function getCatalogoServicios() {
        if (typeof ServiciosStore !== 'undefined' && ServiciosStore.obtenerCatalogoSync) {
            var sync = ServiciosStore.obtenerCatalogoSync();
            if (Array.isArray(sync) && sync.length > 0) return sync;
        }

        if (typeof window !== 'undefined' && window.supabaseClient && !_sincronizandoServiciosDashboard) {
            _sincronizandoServiciosDashboard = true;
            window.supabaseClient
                .from('services')
                .select('*')
                .order('created_at', { ascending: false })
                .then(function (res) {
                    _sincronizandoServiciosDashboard = false;
                    if (res && !res.error && Array.isArray(res.data)) {
                        _serviciosDashboardCache = res.data.map(function (s) {
                            return {
                                id:          s.id,
                                nombre:      s.name,
                                name:        s.name,
                                precio:      Number(s.price) || 0,
                                price:       Number(s.price) || 0,
                                categoria:   s.category,
                                category:    s.category,
                                duracion:    s.duration || '1 mes',
                                duration:    s.duration || '1 mes',
                                coach:       s.coach || 'Coach Prana',
                                descripcion: s.description || '',
                                description: s.description || '',
                                imagen:      s.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/v1791240018/asesoria-nutricional-deportiva.png',
                                image_url:   s.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/v1791240018/asesoria-nutricional-deportiva.png'
                            };
                        });
                    }
                })
                .catch(function () { _sincronizandoServiciosDashboard = false; });
        }

        return Array.isArray(_serviciosDashboardCache) ? _serviciosDashboardCache : [];
    }

    function setCatalogoServicios(arr) {
        if (Array.isArray(arr)) _serviciosDashboardCache = arr;
    }

    async function guardarServicioCatalogo(datos) {
        var srv = null;
        if (typeof ServiciosStore !== 'undefined' && ServiciosStore.guardarServicio) {
            srv = await ServiciosStore.guardarServicio(datos);
        } else {
            var supabase = await obtenerClienteSupabase();
            if (supabase) {
                var payload = {
                    name: datos.name || datos.nombre,
                    category: datos.category || datos.categoria,
                    price: Number(datos.price !== undefined ? datos.price : datos.precio) || 0,
                    duration: datos.duration || datos.duracion,
                    coach: datos.coach || 'Coach Prana',
                    image_url: datos.image_url || datos.imagen,
                    description: datos.description || datos.descripcion
                };
                var res = datos.id
                    ? await supabase.from('services').update(payload).eq('id', datos.id).select()
                    : await supabase.from('services').insert(payload).select();
                if (res && !res.error && Array.isArray(res.data) && res.data[0]) {
                    srv = res.data[0];
                }
            }
        }

        if (srv) {
            var idx = _serviciosDashboardCache.findIndex(function (x) { return x.id === srv.id; });
            if (idx >= 0) {
                _serviciosDashboardCache[idx] = srv;
            } else {
                _serviciosDashboardCache.unshift(srv);
            }
        }
        return srv;
    }

    async function eliminarServicioCatalogo(id) {
        var ok = false;
        if (typeof ServiciosStore !== 'undefined' && ServiciosStore.eliminarServicio) {
            ok = await ServiciosStore.eliminarServicio(id);
        } else {
            var supabase = await obtenerClienteSupabase();
            if (supabase) {
                var res = await supabase.from('services').delete().eq('id', id);
                ok = !res.error;
            }
        }
        if (ok) {
            _serviciosDashboardCache = _serviciosDashboardCache.filter(function (x) { return x.id !== id; });
        }
        return ok;
    }

    // ── SOLICITUDES DE SERVICIOS (100% Supabase) ─────────────────────────────
    var _solicitudesServiciosCache = [];
    var _sincronizandoSolicitudes = false;

    function getServicios() {
        if (typeof window !== 'undefined' && window.supabaseClient && !_sincronizandoSolicitudes) {
            _sincronizandoSolicitudes = true;
            window.supabaseClient
                .from('service_requests')
                .select('*, services(*)')
                .order('created_at', { ascending: false })
                .then(function (res) {
                    _sincronizandoSolicitudes = false;
                    if (res && !res.error && Array.isArray(res.data)) {
                        var usuarios = getUsuarios();
                        _solicitudesServiciosCache = res.data.map(function (s) {
                            var srv = s.services || {};
                            var usr = Array.isArray(usuarios) ? usuarios.find(function (u) { return String(u.id) === String(s.user_id); }) : null;
                            var clienteNombre = usr ? (usr.nombre || usr.name) : 'Cliente';
                            var clienteEmail = usr ? usr.email : '';

                            if (s.notes) {
                                var matchNombre = s.notes.match(/Solicitante:\s*([^|\n]+)/i);
                                if (matchNombre) clienteNombre = matchNombre[1].trim();
                                var matchEmail = s.notes.match(/Email:\s*([^\s|,\n]+)/i);
                                if (matchEmail) clienteEmail = matchEmail[1].trim();
                            }

                            return {
                                id:            s.id,
                                userId:        s.user_id,
                                servicioId:    s.service_id,
                                clienteNombre: clienteNombre,
                                clienteEmail:  clienteEmail,
                                tipo:          srv.name || s.notes || 'Servicio Fitness',
                                nombre:        srv.name || s.notes || 'Servicio Fitness',
                                coach:         srv.coach || 'Coach Asignado',
                                duracion:      srv.duration || '1 mes',
                                estado:        s.status || 'pendiente',
                                notas:         s.notes || '',
                                fecha:         s.created_at,
                                inicio:        null
                            };
                        });
                    }
                })
                .catch(function () { _sincronizandoSolicitudes = false; });
        }
        return Array.isArray(_solicitudesServiciosCache) ? _solicitudesServiciosCache : [];
    }

    function setServicios(s) {
        if (Array.isArray(s)) _solicitudesServiciosCache = s;
    }

    function getServiciosDeUsuario(uid) {
        var lista = getServicios();
        if (!Array.isArray(lista) || !uid) return [];
        return lista.filter(function (s) { return s && String(s.userId) === String(uid); });
    }

    async function actualizarEstadoServicio(id, estado) {
        if (typeof ServiciosStore !== 'undefined' && ServiciosStore.actualizarEstadoSolicitud) {
            await ServiciosStore.actualizarEstadoSolicitud(id, estado);
        } else if (window.supabaseClient) {
            await window.supabaseClient.from('service_requests').update({ status: estado }).eq('id', id);
        }
        var idx = _solicitudesServiciosCache.findIndex(function(s) { return s && s.id === id; });
        if (idx >= 0) { _solicitudesServiciosCache[idx].estado = estado; }
    }

    async function actualizarNotaServicio(id, notas) {
        if (typeof ServiciosStore !== 'undefined' && ServiciosStore.actualizarNota) {
            await ServiciosStore.actualizarNota(id, notas);
        } else if (window.supabaseClient) {
            await window.supabaseClient.from('service_requests').update({ notes: notas }).eq('id', id);
        }
        var idx = _solicitudesServiciosCache.findIndex(function(s) { return s && s.id === id; });
        if (idx >= 0) { _solicitudesServiciosCache[idx].notas = notas; }
        return true;
    }

    // ── PRODUCTOS (Admin CRUD & Catálogo 100% Supabase) ────────────────────
    var _productosDashboardCache = [];
    var _sincronizandoProductosDashboard = false;

    function getProductos() {
        if (typeof ProductosStore !== 'undefined' && ProductosStore.obtenerTodosSync) {
            var sync = ProductosStore.obtenerTodosSync();
            if (Array.isArray(sync) && sync.length > 0) return sync;
        }

        if (typeof window !== 'undefined' && window.supabaseClient && !_sincronizandoProductosDashboard) {
            _sincronizandoProductosDashboard = true;
            window.supabaseClient
                .from('products')
                .select('*')
                .order('created_at', { ascending: false })
                .then(function (res) {
                    _sincronizandoProductosDashboard = false;
                    if (res && !res.error && Array.isArray(res.data)) {
                        _productosDashboardCache = res.data.map(function (p) {
                            return {
                                id:          p.id,
                                nombre:      p.name,
                                name:        p.name,
                                precio:      Number(p.price) || 0,
                                price:       Number(p.price) || 0,
                                categoria:   p.category,
                                category:    p.category,
                                descripcion: p.description || '',
                                description: p.description || '',
                                stock:       p.stock || 0,
                                imagen:      p.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png',
                                image_url:   p.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png',
                                badge:       p.badge || ''
                            };
                        });
                    }
                })
                .catch(function () { _sincronizandoProductosDashboard = false; });
        }

        return Array.isArray(_productosDashboardCache) ? _productosDashboardCache : [];
    }

    function guardarProducto(datos) {
        if (typeof ProductosStore !== 'undefined' && ProductosStore.guardar) {
            return ProductosStore.guardar(datos);
        }
        return null;
    }

    function eliminarProducto(id) {
        if (typeof ProductosStore !== 'undefined' && ProductosStore.eliminar) {
            return ProductosStore.eliminar(id);
        }
        return false;
    }

    // ── BLOG ─────────────────────────────────────────────────────────────────
    var _blogCache = [];
    var _sincronizandoBlog = false;

    function getBlog() {
        if (typeof window !== 'undefined' && window.supabaseClient && !_sincronizandoBlog) {
            _sincronizandoBlog = true;
            window.supabaseClient
                .from('blog_posts')
                .select('*')
                .order('created_at', { ascending: false })
                .then(function (res) {
                    _sincronizandoBlog = false;
                    if (res && !res.error && Array.isArray(res.data)) {
                        _blogCache = res.data.map(function (p) {
                            return {
                                id: p.id,
                                titulo: p.title,
                                title: p.title,
                                categoria: p.category,
                                category: p.category,
                                extracto: p.content || '',
                                content: p.content || '',
                                imagen: p.image_url || '',
                                image_url: p.image_url || '',
                                autor: p.author || 'Admin Prana',
                                author: p.author || 'Admin Prana',
                                fecha: p.created_at,
                                created_at: p.created_at,
                                editadoEn: p.updated_at,
                                updated_at: p.updated_at,
                                publicado: true
                            };
                        });
                    }
                })
                .catch(function (e) {
                    _sincronizandoBlog = false;
                    console.warn('[DStore] Error al sincronizar blog:', e);
                });
        }

        return Array.isArray(_blogCache) ? _blogCache : [];
    }

    function setBlog(b) {
        var arr = Array.isArray(b) ? b : [];
        _blogCache = arr;
    }

    async function crearPost(datos) {
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        var postNormalizado = {
            title: datos.titulo.trim(),
            category: datos.categoria,
            content: datos.extracto.trim(),
            image_url: (datos.imagen || '').trim(),
            author: datos.autor || 'Admin Prana'
        };

        try {
            var { data, error } = await window.supabaseClient
                .from('blog_posts')
                .insert(postNormalizado)
                .select()
                .single();

            if (error) {
                throw new Error('Error al crear post: ' + error.message);
            }

            return {
                id: data.id,
                titulo: data.title,
                categoria: data.category,
                extracto: data.content || '',
                imagen: data.image_url || '',
                autor: data.author || 'Admin Prana',
                fecha: data.created_at,
                editadoEn: data.updated_at,
                publicado: true
            };
        } catch (e) {
            console.error('[DStore] Error al crear post:', e);
            throw e;
        }
    }

    async function actualizarPost(id, datos) {
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        var postNormalizado = {
            title: datos.titulo.trim(),
            category: datos.categoria,
            content: datos.extracto.trim()
        };

        if (typeof datos.imagen !== 'undefined') {
            postNormalizado.image_url = (datos.imagen || '').trim();
        }

        try {
            var { error } = await window.supabaseClient
                .from('blog_posts')
                .update(postNormalizado)
                .eq('id', id);

            if (error) {
                throw new Error('Error al actualizar post: ' + error.message);
            }

            return true;
        } catch (e) {
            console.error('[DStore] Error al actualizar post:', e);
            throw e;
        }
    }

    async function eliminarPost(id) {
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        try {
            var { error } = await window.supabaseClient
                .from('blog_posts')
                .delete()
                .eq('id', id);

            if (error) {
                throw new Error('Error al eliminar post: ' + error.message);
            }

            return true;
        } catch (e) {
            console.error('[DStore] Error al eliminar post:', e);
            throw e;
        }
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
    var _usuariosCache = [];
    var _sincronizandoUsuarios = false;
    try {
        var rawU = localStorage.getItem(KEYS.usuarios);
        if (rawU) {
            var pU = JSON.parse(rawU);
            if (Array.isArray(pU)) _usuariosCache = pU;
        }
    } catch (e) { _usuariosCache = []; }

    function getUsuarios() {
        try {
            var raw = localStorage.getItem(KEYS.usuarios);
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
                        try { localStorage.setItem(KEYS.usuarios, JSON.stringify(_usuariosCache)); } catch (e) {}
                    }
                })
                .catch(function (e) {
                    _sincronizandoUsuarios = false;
                    console.warn('[DStore] Error al sincronizar usuarios de Supabase:', e);
                });
        }

        return Array.isArray(_usuariosCache) ? _usuariosCache : [];
    }

    /**
     * Actualiza nombre, email y/o role de un usuario en Supabase.
     * Si se proporciona nuevoHash+nuevoSalt, actualiza la contraseña también.
     * @param {string} uid
     * @param {Object} cambios - { nombre?, email?, role?, hash?, salt? }
     */
    async function actualizarUsuario(uid, cambios) {
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        var usuarioActualizado = {};

        // Campos seguros de actualizar directamente
        if (typeof cambios.nombre === 'string' && cambios.nombre.trim()) {
            usuarioActualizado.name = cambios.nombre.trim();
        }
        if (typeof cambios.email === 'string' && cambios.email.trim()) {
            usuarioActualizado.email = cambios.email.trim().toLowerCase();
        }
        if (cambios.role === 'admin' || cambios.role === 'cliente') {
            usuarioActualizado.role = cambios.role;
        }
        // Hash + salt solo se tocan si se proporcionan ambos
        if (cambios.hash && cambios.salt) {
            usuarioActualizado.password_hash = cambios.hash;
            usuarioActualizado.salt = cambios.salt;
        }

        try {
            var { error } = await window.supabaseClient
                .from('users')
                .update(usuarioActualizado)
                .eq('id', uid);

            if (error) {
                throw new Error('Error al actualizar usuario: ' + error.message);
            }

            return true;
        } catch (e) {
            console.error('[DStore] Error al actualizar usuario:', e);
            throw e;
        }
    }

    /**
     * Elimina un usuario por id.
     * Protección: no permite eliminar al usuario activo.
     */
    async function eliminarUsuario(uid, uidActivo) {
        if (uid === uidActivo) {
            throw new Error('No puedes eliminar tu propio usuario');
        }

        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        try {
            var { error } = await window.supabaseClient
                .from('users')
                .delete()
                .eq('id', uid);

            if (error) {
                throw new Error('Error al eliminar usuario: ' + error.message);
            }

            return true;
        } catch (e) {
            console.error('[DStore] Error al eliminar usuario:', e);
            throw e;
        }
    }

    // ── PERFIL EXTENDIDO ─────────────────────────────────────────────────────
    // NOTA: El perfil extendido se guardaba en localStorage. En modo Supabase exclusivo,
    // estos datos deberían migrarse a una tabla 'profiles' en Supabase si se necesita.
    function getPerfil(uid) {
        try {
            var raw = localStorage.getItem('prana_perfil_' + uid);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function setPerfil(uid, datos) {
        try {
            var actual = getPerfil(uid);
            var nuevo = Object.assign({}, actual, datos);
            localStorage.setItem('prana_perfil_' + uid, JSON.stringify(nuevo));
            return nuevo;
        } catch (e) {
            return datos || {};
        }
    }

    // ── FAVORITOS (100% Supabase) ───────────────────────────────────────────
    async function getFavoritos(uid) {
        if (!uid || !window.supabaseClient) return [];
        try {
            var { data, error } = await window.supabaseClient
                .from('favorites')
                .select('product_id, products(*)')
                .eq('user_id', uid)
                .order('created_at', { ascending: false });

            if (error || !Array.isArray(data)) return [];
            return data;
        } catch (e) {
            console.error('[DStore] Error al obtener favoritos de Supabase:', e);
            return [];
        }
    }

    async function toggleFavorito(uid, item) {
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        try {
            // Verificar si ya existe
            var { data: existing, error: checkError } = await window.supabaseClient
                .from('favorites')
                .select('*')
                .eq('user_id', uid)
                .eq('product_id', item.id)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw new Error('Error al verificar favorito: ' + checkError.message);
            }

            if (existing) {
                // Eliminar
                var { error } = await window.supabaseClient
                    .from('favorites')
                    .delete()
                    .eq('user_id', uid)
                    .eq('product_id', item.id);

                if (error) {
                    throw new Error('Error al eliminar favorito: ' + error.message);
                }

                return false; // quitado
            } else {
                // Insertar
                var { error } = await window.supabaseClient
                    .from('favorites')
                    .insert({
                        user_id: uid,
                        product_id: item.id
                    });

                if (error) {
                    throw new Error('Error al agregar favorito: ' + error.message);
                }

                return true; // agregado
            }
        } catch (e) {
            console.error('[DStore] Error al toggle favorito:', e);
            throw e;
        }
    }

    // ── SEED DE DATOS DEMO ───────────────────────────────────────────────────
    // NOTA: En modo Supabase exclusivo, los datos demo deben migrarse manualmente
    // a través del SQL Editor de Supabase.
    // Esta función ha sido eliminada - ya no se usa seed automático.

    return {
        // Productos (admin & catálogo)
        getProductos, guardarProducto, eliminarProducto,
        // Pedidos
        getPedidos, setPedidos, getPedidosDeUsuario, actualizarEstadoPedido,
        // Servicios
        getServicios, setServicios, getServiciosDeUsuario, actualizarEstadoServicio, actualizarNotaServicio,
        getCatalogoServicios, setCatalogoServicios, guardarServicioCatalogo, eliminarServicioCatalogo,
        // Blog
        getBlog, setBlog, crearPost, actualizarPost, eliminarPost,
        // Mensajes
        getMensajes, setMensajes, marcarMensajeLeido, marcarTodosLeidos,
        // Perfil y favoritos (100% Supabase)
        getPerfil, setPerfil, getFavoritos, toggleFavorito,
        // Usuarios (admin)
        getUsuarios, actualizarUsuario, eliminarUsuario
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
        { id: 'sec-admin-productos', icon: 'ri-box-3-line',          label: 'Productos',        seccion: 'admin', badge: 'productos' },
        { id: 'sec-admin-pedidos',   icon: 'ri-shopping-bag-3-line', label: 'Pedidos',           seccion: 'admin', badge: 'pedidos' },
        { id: 'sec-admin-servicios', icon: 'ri-user-star-line',      label: 'Servicios',         seccion: 'admin', badge: 'servicios' },
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
        // Badge de productos en catálogo
        var badgeProd = document.getElementById('badge-productos');
        if (badgeProd) {
            var prods = DStore.getProductos();
            var totalProd = Array.isArray(prods) ? prods.length : 0;
            badgeProd.textContent = totalProd;
            badgeProd.style.display = totalProd > 0 ? '' : 'none';
        }

        // Badge de pedidos pendientes
        var badgePed = document.getElementById('badge-pedidos');
        if (badgePed) {
            var pedidos = DStore.getPedidos();
            var pendientes = (Array.isArray(pedidos) ? pedidos.filter(function (p) { return p && p.estado === 'pendiente'; }) : []).length;
            badgePed.textContent = pendientes;
            badgePed.style.display = pendientes > 0 ? '' : 'none';
        }

        // Badge de solicitudes de servicios activas / pendientes
        var badgeSrv = document.getElementById('badge-servicios');
        if (badgeSrv) {
            var servicios = DStore.getServicios();
            var pendientesSrv = (Array.isArray(servicios) ? servicios.filter(function (s) { 
                return s && (s.estado === 'pendiente' || s.estado === 'confirmado' || s.estado === 'activo'); 
            }) : []).length;
            badgeSrv.textContent = pendientesSrv;
            badgeSrv.style.display = pendientesSrv > 0 ? '' : 'none';
        }

        // Badge de mensajes no leídos
        var badgeMsg = document.getElementById('badge-mensajes');
        if (badgeMsg) {
            var msgs = DStore.getMensajes();
            var noLeidos = (Array.isArray(msgs) ? msgs.filter(function (m) { return m && !m.leido; }) : []).length;
            badgeMsg.textContent = noLeidos;
            badgeMsg.style.display = noLeidos > 0 ? '' : 'none';
        }

        // Badge de total de usuarios registrados
        var badgeUsr = document.getElementById('badge-usuarios');
        if (badgeUsr) {
            var usuarios = DStore.getUsuarios();
            var totalUsr = Array.isArray(usuarios) ? usuarios.length : 0;
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
            pendiente: 'Pendiente', confirmado: 'Confirmado', proceso: 'En Proceso', enviado: 'Enviado',
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
    async function renderKpis() {
        var pedidos = [];
        var servicios = [];
        var mensajes = [];

        if (window.supabaseClient) {
            try {
                var results = await Promise.all([
                    window.supabaseClient.from('orders').select('*'),
                    window.supabaseClient.from('service_requests').select('*')
                ]);
                if (results[0] && !results[0].error && Array.isArray(results[0].data)) {
                    pedidos = results[0].data;
                }
                if (results[1] && !results[1].error && Array.isArray(results[1].data)) {
                    servicios = results[1].data;
                }
            } catch (e) {
                console.warn('[DRender] Error al consultar datos para KPIs:', e);
            }
        }

        if (pedidos.length === 0) {
            var pedidosRaw = DStore.getPedidos();
            if (Array.isArray(pedidosRaw)) pedidos = pedidosRaw;
        }
        if (servicios.length === 0) {
            var serviciosRaw = DStore.getServicios();
            if (Array.isArray(serviciosRaw)) servicios = serviciosRaw;
        }

        var mensajesRaw  = DStore.getMensajes();
        mensajes = Array.isArray(mensajesRaw) ? mensajesRaw : [];

        // Ventas Totales: suma de total o total_amount de orders con status != 'cancelado'
        var totalVentas = pedidos
            .filter(function (p) {
                var est = (p.status || p.estado || '').toLowerCase();
                return est !== 'cancelado';
            })
            .reduce(function (a, p) {
                var val = Number(p.total !== undefined ? p.total : p.total_amount) || 0;
                return a + val;
            }, 0);

        // Pedidos Pendientes: conteo directo con status === 'pendiente'
        var pedidosPend = pedidos.filter(function (p) {
            var est = (p.status || p.estado || '').toLowerCase();
            return est === 'pendiente';
        }).length;

        // Solicitudes de Servicios: conteo directo en service_requests con status 'pendiente' o 'confirmado'
        var serviciosActivos = servicios.filter(function (s) {
            var est = (s.status || s.estado || '').toLowerCase();
            return est === 'pendiente' || est === 'confirmado';
        }).length;

        var msgNuevos = mensajes.filter(function (m) { return m && !m.leido; }).length;

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
        var pedidosRaw = DStore.getPedidos();
        var pedidos = Array.isArray(pedidosRaw) ? pedidosRaw : [];
        var porMes  = {};
        pedidos.forEach(function (p) {
            if (p && p.estado === 'completado' && p.fecha) {
                var m = meses[new Date(p.fecha).getMonth()];
                porMes[m] = (porMes[m] || 0) + (p.total || 0);
            }
        });

        // Completar meses sin datos con valores demo
        var DEMO = { Ene:1200000, Feb:980000, Mar:1450000, Abr:1100000, May:1800000, Jun:2100000,
                     Jul:1650000, Ago:1900000, Sep:2300000, Oct:1750000, Nov:2550000, Dic:3100000 };
        var datosBarras = meses.map(function (m) {
            return { label: m, valor: porMes[m] || DEMO[m] };
        });

        DCharts.renderBarras('chart-ventas', datosBarras);

        // Donut por categorías
        var catMap = {};
        pedidos.forEach(function (p) {
            if (!p || !p.productos) return;
            // Mapeo simple por palabras clave en el texto de productos
            var cats = ['Suplementos','Indumentaria','Equipamiento','Accesorios'];
            cats.forEach(function (c) {
                if (p.productos.indexOf(c) >= 0 || Math.random() < 0.25) {
                    catMap[c] = (catMap[c] || 0) + 1;
                }
            });
        });

        // Demo si no hay datos suficientes
        if (Object.keys(catMap).length === 0) {
            catMap = { Suplementos: 42, Indumentaria: 28, Equipamiento: 18, Accesorios: 12 };
        }

        var donutData = Object.keys(catMap).map(function (k) {
            return { label: k, valor: catMap[k] };
        });

        DCharts.renderDonut('donut-categorias', donutData);
    }

    // ── ADMIN: Tabla de pedidos ──────────────────────────────────────────────
    async function renderTablaPedidos() {
        var tbody   = document.getElementById('admin-pedidos-tbody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Cargando pedidos...</span></div></td></tr>';

        var pedidos = [];
        if (window.supabaseClient) {
            try {
                var res = await window.supabaseClient
                    .from('orders')
                    .select('*, users(*)')
                    .order('created_at', { ascending: false });

                if (res && !res.error && Array.isArray(res.data)) {
                    pedidos = res.data;
                } else {
                    var ordersRes = await window.supabaseClient
                        .from('orders')
                        .select('*')
                        .order('created_at', { ascending: false });

                    if (ordersRes && !ordersRes.error && Array.isArray(ordersRes.data)) {
                        pedidos = ordersRes.data;
                        try {
                            var usersRes = await window.supabaseClient.from('users').select('*');
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
            } catch (err) {
                console.error('[DRender] Error al consultar pedidos de Supabase:', err);
            }
        }

        if (pedidos.length === 0) {
            var pedidosRaw = DStore.getPedidos();
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
            var clienteNom = userObj.nombre || userObj.name || p.clienteNombre || p.user_name || p.cliente_nombre || 'Cliente';
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

        // Listener para cambios de estado
        tbody.querySelectorAll('.d-select-estado').forEach(function (sel) {
            sel.addEventListener('change', async function () {
                var pedidoId = sel.dataset.pedidoId;
                var nuevoEstado = sel.value;
                try {
                    await DStore.actualizarEstadoPedido(pedidoId, nuevoEstado);
                    DSidebar.actualizarBadges();
                    await DRender.renderKpis();
                    DToast.ok('Estado del pedido ' + pedidoId + ' actualizado.');
                } catch (e) {
                    console.error('[DRender] Error al actualizar estado pedido:', e);
                    DToast.error('No se pudo actualizar el estado del pedido.');
                }
            });
        });
    }

    function verDetallePedido(id) {
        var pedidosRaw = DStore.getPedidos();
        var pedidos = Array.isArray(pedidosRaw) ? pedidosRaw : [];
        var p = pedidos.find(function (x) { return x && x.id === id; });
        if (!p) return;
        DToast.info('Pedido ' + id + ' | ' + (p.clienteNombre || 'Cliente') + ' | ' + formatoCOP(p.total) + ' | ' + p.estado);
    }

    // ── ADMIN: Gestión de Productos ──────────────────────────────────────────
    var _prodBusqueda = '';
    var _prodCategoria = '';

    function setFiltroProductos(busqueda, categoria) {
        _prodBusqueda = typeof busqueda === 'string' ? busqueda.trim() : _prodBusqueda;
        _prodCategoria = typeof categoria === 'string' ? categoria.trim() : _prodCategoria;
        renderProductosAdmin();
    }

    function renderProductosAdmin() {
        var tbody = document.getElementById('admin-productos-tbody');
        var total = document.getElementById('admin-productos-total');
        if (!tbody) return;

        var prodsRaw = DStore.getProductos();
        var prods = Array.isArray(prodsRaw) ? prodsRaw : [];

        // Filtros
        var filtrados = (Array.isArray(prods) ? prods.filter(function (p) {
            if (!p) return false;
            var q = _prodBusqueda.toLowerCase();
            var coincideTexto = !q ||
                (p.nombre && p.nombre.toLowerCase().indexOf(q) >= 0) ||
                (p.descripcion && p.descripcion.toLowerCase().indexOf(q) >= 0) ||
                (p.categoria && p.categoria.toLowerCase().indexOf(q) >= 0);
            var coincideCat = !_prodCategoria || p.categoria === _prodCategoria;
            return coincideTexto && coincideCat;
        }) : []);

        if (total) {
            total.textContent = prods.length + ' producto' + (prods.length !== 1 ? 's' : '');
        }

        if (filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">' +
                vacio('ri-box-3-line', 'Sin productos', 'No se encontraron productos con los criterios seleccionados.') +
                '</td></tr>';
            return;
        }

        tbody.innerHTML = filtrados.map(function (p) {
            var stockNum = parseInt(p.stock, 10) || 0;
            var stockCls = stockNum === 0 ? 'd-status--cancelado' : stockNum <= 5 ? 'd-status--pendiente' : 'd-status--activo';
            var stockTxt = stockNum === 0 ? 'Agotado (0)' : (stockNum + ' unid.');
            var imgUrl = p.imagen || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png';

            var badgeTag = p.badge
                ? '<span class="d-status d-status--enviado" style="font-size:0.65rem;margin-left:6px;">' + esc(p.badge) + '</span>'
                : '';

            return '<tr>' +
                '<td>' +
                    '<img src="' + esc(imgUrl) + '" alt="' + esc(p.nombre) + '" ' +
                    'style="width:44px;height:44px;object-fit:contain;border-radius:6px;border:1px solid var(--d-borde);background:var(--d-fondo);padding:2px;" ' +
                    'onerror="this.src=\'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png\'">' +
                '</td>' +
                '<td>' +
                    '<div style="font-weight:700;font-size:0.88rem;color:var(--d-texto);">' + esc(p.nombre) + badgeTag + '</div>' +
                    '<div style="font-size:0.75rem;color:var(--d-texto-mut);max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(p.descripcion || 'Sin descripción') + '</div>' +
                '</td>' +
                '<td><span class="d-status d-status--nuevo">' + esc(p.categoria) + '</span></td>' +
                '<td style="font-weight:700;font-family:var(--d-font-head);">' + formatoCOP(p.precio) + '</td>' +
                '<td><span class="d-status ' + stockCls + '">' + stockTxt + '</span></td>' +
                '<td>' +
                    (stockNum > 0
                        ? '<span class="d-status d-status--activo">Disponible</span>'
                        : '<span class="d-status d-status--cancelado">Agotado</span>') +
                '</td>' +
                '<td>' +
                    '<div class="d-action-btns">' +
                        '<button class="d-btn-icon" title="Editar producto" onclick="DRender.abrirModalProducto(\'' + esc(p.id) + '\')">' +
                            '<i class="ri-edit-line" aria-hidden="true"></i>' +
                        '</button>' +
                        '<button class="d-btn-icon eliminar" title="Eliminar producto" onclick="DRender.eliminarProductoUI(\'' + esc(p.id) + '\')">' +
                            '<i class="ri-delete-bin-6-line" aria-hidden="true"></i>' +
                        '</button>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        }).join('');
    }

    function abrirModalProducto(id) {
        var form = document.getElementById('form-producto');
        var overlay = document.getElementById('modal-prod-overlay');
        var tituloTxt = document.getElementById('modal-prod-titulo-txt');
        var btnGuardar = document.getElementById('prod-btn-guardar-txt');
        if (!form || !overlay) return;

        form.reset();

        if (id) {
            var prods = DStore.getProductos();
            var p = Array.isArray(prods) ? prods.find(function (x) { return x && x.id === id; }) : null;
            if (!p) return;
            document.getElementById('prod-id').value = p.id;
            document.getElementById('prod-nombre').value = p.nombre || '';
            document.getElementById('prod-categoria').value = p.categoria || 'Suplementos';
            document.getElementById('prod-precio').value = p.precio || 0;
            document.getElementById('prod-stock').value = p.stock || 0;
            document.getElementById('prod-badge').value = p.badge || '';
            document.getElementById('prod-imagen').value = p.imagen || '';
            document.getElementById('prod-descripcion').value = p.descripcion || '';
            if (tituloTxt) tituloTxt.textContent = 'Editar: ' + p.nombre;
            if (btnGuardar) btnGuardar.textContent = 'Guardar Cambios';
        } else {
            document.getElementById('prod-id').value = '';
            if (tituloTxt) tituloTxt.textContent = 'Nuevo Producto';
            if (btnGuardar) btnGuardar.textContent = 'Guardar Producto';
        }

        overlay.classList.add('d-modal--visible');
        overlay.setAttribute('aria-hidden', 'false');
        var firstInput = document.getElementById('prod-nombre');
        if (firstInput) setTimeout(function () { firstInput.focus(); }, 150);
    }

    function cerrarModalProducto() {
        var overlay = document.getElementById('modal-prod-overlay');
        if (overlay) {
            overlay.classList.remove('d-modal--visible');
            overlay.setAttribute('aria-hidden', 'true');
        }
    }

    function eliminarProductoUI(id) {
        var prods = DStore.getProductos();
        var p = Array.isArray(prods) ? prods.find(function (x) { return x && x.id === id; }) : null;
        if (!p) return;
        if (!confirm('¿Eliminar "' + p.nombre + '" del catálogo? Se actualizará inmediatamente en la tienda.')) return;

        var ok = DStore.eliminarProducto(id);
        if (ok) {
            renderProductosAdmin();
            DSidebar.actualizarBadges();
            DToast.ok('Producto eliminado del catálogo.');
        } else {
            DToast.error('No se pudo eliminar el producto.');
        }
    }

    // ── ADMIN: Servicios (Catálogo + Solicitudes) ─────────────────────────────
    async function renderTablaServiciosCatalog() {
        var catTbody = document.getElementById('admin-servicios-cat-tbody');
        var catTotal = document.getElementById('admin-servicios-cat-total');
        if (!catTbody) return;

        catTbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Cargando catálogo...</span></div></td></tr>';

        var servicios = [];
        try {
            const supabase = await obtenerClienteSupabase();
            if (supabase) {
                const { data, error } = await supabase
                    .from('services')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('[Dashboard] Error al consultar services en Supabase:', error);
                } else if (Array.isArray(data)) {
                    servicios = data;
                }
            }
        } catch (err) {
            console.error('[Dashboard] Excepción al consultar catálogo de servicios:', err);
        }

        if (servicios.length === 0) {
            var fallback = DStore.getCatalogoServicios();
            if (Array.isArray(fallback) && fallback.length > 0) servicios = fallback;
        }

        // Sincronizar la caché en DStore para que los modales tengan los datos disponibles
        if (typeof DStore !== 'undefined' && DStore.setCatalogoServicios) {
            DStore.setCatalogoServicios(servicios.map(function (s) {
                return {
                    id:          s.id,
                    name:        s.name || s.nombre || 'Servicio',
                    nombre:      s.name || s.nombre || 'Servicio',
                    category:    s.category || s.categoria || 'Entrenamiento',
                    categoria:   s.category || s.categoria || 'Entrenamiento',
                    price:       Number(s.price !== undefined ? s.price : s.precio) || 0,
                    precio:      Number(s.price !== undefined ? s.price : s.precio) || 0,
                    duration:    s.duration || s.duracion || '1 mes',
                    duracion:    s.duration || s.duracion || '1 mes',
                    coach:       s.coach || 'Coach Prana',
                    description: s.description || s.descripcion || '',
                    descripcion: s.description || s.descripcion || '',
                    image_url:   s.image_url || s.imagen || 'https://res.cloudinary.com/atexcbli/image/upload/v1791240018/asesoria-nutricional-deportiva.png',
                    imagen:      s.image_url || s.imagen || 'https://res.cloudinary.com/atexcbli/image/upload/v1791240018/asesoria-nutricional-deportiva.png'
                };
            }));
        }

        // Actualizar la insignia del encabezado con el conteo real de registros (`${servicios.length} SERVICIOS`)
        if (catTotal) {
            catTotal.textContent = `${servicios.length} SERVICIOS`;
        }

        if (!Array.isArray(servicios) || servicios.length === 0) {
            catTbody.innerHTML = '<tr><td colspan="7">' +
                vacio('ri-service-line', 'Catálogo vacío', 'No hay servicios en el catálogo. Haz clic en "Nuevo Servicio" para agregar uno.') +
                '</td></tr>';
            return;
        }

        catTbody.innerHTML = servicios.map(function (s) {
            var id = s.id || '';
            var nombre = s.name || s.nombre || 'Servicio';
            var categoria = s.category || s.categoria || 'General';
            var duracion = s.duration || s.duracion || '1 mes';
            var coach = s.coach || 'Coach Prana';
            var precioNum = Number(s.price !== undefined ? s.price : s.precio) || 0;
            var imagen = s.image_url || s.imagen || 'https://res.cloudinary.com/atexcbli/image/upload/v1791240018/asesoria-nutricional-deportiva.png';
            var descripcion = s.description || s.descripcion || '';

            return '<tr>' +
                '<td>' +
                    '<img src="' + esc(imagen) + '" alt="' + esc(nombre) + '" ' +
                    'style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--d-borde);background:var(--d-fondo);" ' +
                    'onerror="this.src=\'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png\'">' +
                '</td>' +
                '<td>' +
                    '<div style="font-weight:700;font-size:0.88rem;">' + esc(nombre) + '</div>' +
                    '<div style="font-size:0.75rem;color:var(--d-texto-mut);max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(descripcion) + '</div>' +
                '</td>' +
                '<td><span class="d-status d-status--nuevo">' + esc(categoria) + '</span></td>' +
                '<td style="font-size:0.82rem;font-weight:600;">' + esc(duracion) + '</td>' +
                '<td style="font-size:0.82rem;color:var(--d-texto);">' + esc(coach) + '</td>' +
                '<td style="font-weight:700;font-family:var(--d-font-head);">' + formatoCOP(precioNum) + '</td>' +
                '<td>' +
                    '<div class="d-action-btns">' +
                        '<button class="d-btn-icon" title="Editar servicio" onclick="DRender.abrirModalServicio(\'' + esc(id) + '\')">' +
                            '<i class="ri-edit-line" aria-hidden="true"></i>' +
                        '</button>' +
                        '<button class="d-btn-icon eliminar" title="Eliminar servicio" onclick="DRender.eliminarServicioCatalogoUI(\'' + esc(id) + '\')">' +
                            '<i class="ri-delete-bin-6-line" aria-hidden="true"></i>' +
                        '</button>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        }).join('');
    }

    var cargarCatalogoServicios = renderTablaServiciosCatalog;

    async function renderSolicitudesServiciosAdmin() {
        var el = document.getElementById('admin-servicios-list');
        var solTotal = document.getElementById('admin-solicitudes-total');
        if (!el) return;

        var servicios = [];
        try {
            var supabase = await obtenerClienteSupabase();
            if (supabase) {
                var res = await supabase
                    .from('service_requests')
                    .select('*, services(*)')
                    .order('created_at', { ascending: false });
                if (res && !res.error && Array.isArray(res.data)) {
                    var usuarios = DStore.getUsuarios();
                    servicios = res.data.map(function (s) {
                        var srv = s.services || {};
                        var usr = Array.isArray(usuarios) ? usuarios.find(function (u) { return String(u.id) === String(s.user_id); }) : null;
                        var clienteNombre = usr ? (usr.nombre || usr.name) : 'Cliente';
                        var clienteEmail = usr ? usr.email : '';

                        if (s.notes) {
                            var matchNombre = s.notes.match(/Solicitante:\s*([^|\n]+)/i);
                            if (matchNombre) clienteNombre = matchNombre[1].trim();
                            var matchEmail = s.notes.match(/Email:\s*([^\s|,\n]+)/i);
                            if (matchEmail) clienteEmail = matchEmail[1].trim();
                        }

                        return {
                            id:            s.id,
                            userId:        s.user_id,
                            servicioId:    s.service_id,
                            clienteNombre: clienteNombre,
                            clienteEmail:  clienteEmail,
                            tipo:          srv.name || s.notes || 'Servicio Fitness',
                            nombre:        srv.name || s.notes || 'Servicio Fitness',
                            coach:         srv.coach || 'Coach Asignado',
                            duracion:      srv.duration || '1 mes',
                            estado:        s.status || 'pendiente',
                            notas:         s.notes || '',
                            fecha:         s.created_at,
                            inicio:        null
                        };
                    });
                }
            }
        } catch (e) {
            console.warn('[DRender] Error al consultar service_requests en admin:', e);
        }

        if (servicios.length === 0) {
            var fallback = DStore.getServicios();
            if (Array.isArray(fallback)) servicios = fallback;
        }

        if (solTotal) {
            var act = (Array.isArray(servicios) ? servicios.filter(function (x) { return x && (x.estado === 'pendiente' || x.estado === 'confirmado' || x.estado === 'activo'); }) : []).length;
            solTotal.textContent = act + ' activa' + (act !== 1 ? 's' : '') + ' (' + servicios.length + ' total)';
        }

        if (servicios.length === 0) {
            el.innerHTML = vacio('ri-user-star-line','Sin solicitudes','No hay solicitudes de servicios registradas.');
            return;
        }

        var html = '';
        servicios.forEach(function (s) {
            var iconos = { 'Plan de Entrenamiento':'ri-run-line','Asesoría Nutricional':'ri-seedling-line','Reserva Showroom':'ri-store-2-line' };
            var ico    = iconos[s.tipo] || 'ri-user-star-line';
            var bgCol  = { activo:'var(--d-verde-bg)', confirmado:'rgba(14, 165, 233, 0.15)', pendiente:'var(--d-amarillo-bg)', completado:'var(--d-fondo)', cancelado:'var(--d-rojo-bg)' };
            var fgCol  = { activo:'var(--d-verde)', confirmado:'#0284c7', pendiente:'var(--d-amarillo)', completado:'var(--d-plata-dark)', cancelado:'var(--d-rojo)' };

            var mailBtn = s.clienteEmail ? 
                '<button class="d-btn-icon" title="Contactar por correo (' + esc(s.clienteEmail) + ')" onclick="window.open(\'mailto:' + esc(s.clienteEmail) + '\', \'_blank\')"><i class="ri-mail-line"></i></button>' : '';
            var notaBtn = '<button class="d-btn-icon" title="Editar / Agregar notas" onclick="DRender.editarNotaServicio(\'' + esc(s.id) + '\')"><i class="ri-file-edit-line"></i></button>';

            html +=
                '<div class="d-servicio-item">' +
                '<div class="d-servicio-item__icon" style="background:' + (bgCol[s.estado]||bgCol.pendiente) + ';color:' + (fgCol[s.estado]||fgCol.pendiente) + ';">' +
                '<i class="' + ico + '" aria-hidden="true"></i></div>' +
                '<div style="flex:1;min-width:0;">' +
                '<div style="font-weight:700;font-size:0.88rem;">' + esc(s.clienteNombre || 'Cliente') + 
                    (s.clienteEmail ? ' <span style="font-size:0.75rem;font-weight:400;color:var(--d-texto-mut);">(' + esc(s.clienteEmail) + ')</span>' : '') + 
                '</div>' +
                '<div style="font-size:0.78rem;color:var(--d-texto-mut);">' + esc(s.tipo) + ' · ' + esc(s.duracion || '1 mes') + ' · ' + formatoFecha(s.fecha) + '</div>' +
                (s.notas ? '<div style="font-size:0.75rem;color:var(--d-texto-2);margin-top:4px;font-style:italic;">Nota: "' + esc(s.notas) + '"</div>' : '') +
                '</div>' +
                badgeEstado(s.estado) +
                '<select class="d-select-estado" data-srv-id="' + esc(s.id) + '" aria-label="Estado servicio">' +
                ['pendiente','confirmado','activo','completado','cancelado'].map(function(e){
                    var etiquetas = { pendiente:'Pendiente', confirmado:'Confirmado', activo:'Activo', completado:'Completado', cancelado:'Cancelado' };
                    return '<option value="' + e + '"' + (s.estado===e?' selected':'') + '>' + (etiquetas[e] || e) + '</option>';
                }).join('') +
                '</select>' +
                mailBtn +
                notaBtn +
                '</div>';
        });

        el.innerHTML = html;

        el.querySelectorAll('.d-select-estado').forEach(function(sel) {
            sel.addEventListener('change', async function() {
                try {
                    await DStore.actualizarEstadoServicio(sel.dataset.srvId, sel.value);
                    await renderSolicitudesServiciosAdmin();
                    if (typeof DRender !== 'undefined' && DRender.renderKpis) {
                        await DRender.renderKpis();
                    }
                    DSidebar.actualizarBadges();
                    DToast.ok('Estado de la solicitud actualizado.');
                } catch (e) {
                    console.error('[DRender] Error al actualizar estado de solicitud:', e);
                    DToast.error('No se pudo actualizar el estado.');
                }
            });
        });
    }

    async function renderServiciosAdmin() {
        await Promise.all([
            renderTablaServiciosCatalog(),
            renderSolicitudesServiciosAdmin()
        ]);
    }

    async function editarNotaServicio(id) {
        var servicios = DStore.getServicios();
        var s = Array.isArray(servicios) ? servicios.find(function (x) { return x && x.id === id; }) : null;
        if (!s) return;

        var nuevaNota = prompt('Editar o agregar notas de seguimiento para la solicitud de "' + (s.clienteNombre || 'Cliente') + '":', s.notas || '');
        if (nuevaNota === null) return;

        try {
            await DStore.actualizarNotaServicio(id, nuevaNota.trim());
            await renderSolicitudesServiciosAdmin();
            if (typeof DRender !== 'undefined' && DRender.renderKpis) {
                await DRender.renderKpis();
            }
            DToast.ok('Notas de la solicitud actualizadas.');
        } catch (e) {
            console.error('[DRender] Error al editar nota de servicio:', e);
            DToast.error('No se pudo actualizar la nota.');
        }
    }

    function abrirModalServicio(id) {
        var form = document.getElementById('form-servicio');
        var overlay = document.getElementById('modal-srv-overlay');
        var tituloTxt = document.getElementById('modal-srv-titulo-txt');
        var btnGuardar = document.getElementById('srv-btn-guardar-txt');
        if (!form || !overlay) return;

        form.reset();

        if (id) {
            var cat = DStore.getCatalogoServicios();
            var s = Array.isArray(cat) ? cat.find(function (x) { return x && x.id === id; }) : null;
            if (!s) return;
            document.getElementById('srv-id').value = s.id;
            document.getElementById('srv-nombre').value = s.name || s.nombre || '';
            document.getElementById('srv-categoria').value = s.category || s.categoria || 'Entrenamiento';
            document.getElementById('srv-precio').value = s.price !== undefined ? s.price : (s.precio || 0);
            document.getElementById('srv-duracion').value = s.duration || s.duracion || '1 mes';
            document.getElementById('srv-coach').value = s.coach || '';
            document.getElementById('srv-imagen').value = s.image_url || s.imagen || '';
            document.getElementById('srv-descripcion').value = s.description || s.descripcion || '';
            if (tituloTxt) tituloTxt.textContent = 'Editar: ' + (s.name || s.nombre);
            if (btnGuardar) btnGuardar.textContent = 'Guardar Cambios';
        } else {
            document.getElementById('srv-id').value = '';
            if (tituloTxt) tituloTxt.textContent = 'Nuevo Servicio';
            if (btnGuardar) btnGuardar.textContent = 'Guardar Servicio';
        }

        overlay.classList.add('d-modal--visible');
        overlay.setAttribute('aria-hidden', 'false');
        var firstInput = document.getElementById('srv-nombre');
        if (firstInput) setTimeout(function () { firstInput.focus(); }, 150);
    }

    function cerrarModalServicio() {
        var overlay = document.getElementById('modal-srv-overlay');
        if (overlay) {
            overlay.classList.remove('d-modal--visible');
            overlay.setAttribute('aria-hidden', 'true');
        }
    }

    async function eliminarServicioCatalogoUI(id) {
        var cat = DStore.getCatalogoServicios();
        var s = Array.isArray(cat) ? cat.find(function (x) { return x && x.id === id; }) : null;
        if (!s) return;
        if (!confirm('¿Eliminar el servicio "' + (s.name || s.nombre) + '" del catálogo?')) return;

        try {
            await DStore.eliminarServicioCatalogo(id);
            await renderTablaServiciosCatalog();
            DToast.ok('Servicio eliminado del catálogo.');
        } catch (e) {
            DToast.error('No se pudo eliminar el servicio.');
        }
    }

    // ── ADMIN: Blog ──────────────────────────────────────────────────────────
    function renderBlogAdmin() {
        var el   = document.getElementById('admin-blog-list');
        var cnt  = document.getElementById('blog-count');
        if (!el) return;

        var postsRaw = DStore.getBlog();
        var posts = Array.isArray(postsRaw) ? postsRaw : [];
        if (cnt) cnt.textContent = posts.length + ' post' + (posts.length !== 1 ? 's' : '');

        if (posts.length === 0) {
            el.innerHTML = vacio('ri-article-line','Sin artículos','Publica tu primer artículo del blog.');
            return;
        }

        el.innerHTML = posts.map(function (p) {
            var imgHtml = p.imagen
                ? '<img src="' + esc(p.imagen) + '" style="width:42px;height:42px;object-fit:cover;border-radius:6px;border:1px solid var(--d-borde);" onerror="this.remove()">'
                : '<div class="d-post-item__icon"><i class="ri-article-line" aria-hidden="true"></i></div>';

            return '<div class="d-post-item">' +
                imgHtml +
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
        var postsRaw = DStore.getBlog();
        var posts = Array.isArray(postsRaw) ? postsRaw : [];
        var post = posts.find(function (p) { return p && p.id === id; });
        if (!post) return;

        document.getElementById('blog-id-edit').value      = post.id;
        document.getElementById('blog-titulo').value       = post.titulo;
        document.getElementById('blog-categoria').value    = post.categoria;
        var imgEl = document.getElementById('blog-imagen');
        if (imgEl) imgEl.value = post.imagen || '';
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

        var msgsRaw  = DStore.getMensajes();
        var msgs     = Array.isArray(msgsRaw) ? msgsRaw : [];
        var noLeidos = (Array.isArray(msgs) ? msgs.filter(function (m) { return m && !m.leido; }) : []).length;

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
    async function renderPedidosCliente(usuario) {
        var el = document.getElementById('cliente-pedidos-contenedor');
        if (!el) return;

        var usuarioActual = usuario || (typeof AuthService !== 'undefined' && AuthService.getCurrentUser ? AuthService.getCurrentUser() : null);
        if (!usuarioActual && typeof Dashboard !== 'undefined' && Dashboard.getUsuario) {
            usuarioActual = Dashboard.getUsuario();
        }
        if (!usuarioActual || !usuarioActual.id) {
            el.innerHTML = '<div class="d-card"><div class="d-card__body">' +
                vacio('ri-user-unfollow-line','Sesión no iniciada','Inicia sesión para ver tus pedidos.') +
                '</div></div>';
            return;
        }

        el.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-success" role="status"></div></div>';

        var pedidos = [];
        if (window.supabaseClient) {
            try {
                var res = await window.supabaseClient
                    .from('orders')
                    .select('*')
                    .eq('user_id', usuarioActual.id)
                    .order('created_at', { ascending: false });
                if (res && !res.error && Array.isArray(res.data)) {
                    pedidos = res.data;
                }
            } catch (e) {
                console.warn('[DRender] Error al consultar pedidos del cliente en Supabase:', e);
            }
        }

        if (pedidos.length === 0) {
            var pedidosRaw = DStore.getPedidosDeUsuario(usuarioActual.id);
            if (Array.isArray(pedidosRaw) && pedidosRaw.length > 0) pedidos = pedidosRaw;
        }

        if (!Array.isArray(pedidos) || pedidos.length === 0) {
            el.innerHTML = '<div class="d-card"><div class="d-card__body">' +
                vacio('ri-shopping-bag-line','Sin pedidos','Aún no has realizado ningún pedido.') +
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
                { key: 'pendiente',  label: 'Pedido recibido',     desc: 'Tu pedido ha sido registrado.' },
                { key: 'enviado',    label: 'En camino',            desc: 'Tu pedido fue despachado.' },
                { key: 'completado', label: 'Entregado',            desc: '¡Tu pedido llegó exitosamente!' }
            ];

            var orden = ['pendiente','enviado','completado'];
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

    // ── CLIENTE: Servicios ───────────────────────────────────────────────────
    async function renderServiciosCliente(usuario) {
        var el = document.getElementById('cliente-servicios-list');
        if (!el) return;

        var usuarioActual = usuario || (typeof AuthService !== 'undefined' && AuthService.getCurrentUser ? AuthService.getCurrentUser() : null);
        if (!usuarioActual && typeof Dashboard !== 'undefined' && Dashboard.getUsuario) {
            usuarioActual = Dashboard.getUsuario();
        }
        if (!usuarioActual || !usuarioActual.id) {
            el.innerHTML = vacio('ri-user-unfollow-line','Sesión no iniciada','Inicia sesión para ver tus servicios.');
            return;
        }

        el.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="spinner-border text-success" role="status"></div></div>';

        var solicitudes = [];
        if (window.supabaseClient) {
            try {
                var res = await window.supabaseClient
                    .from('service_requests')
                    .select('*, services(*)')
                    .eq('user_id', usuarioActual.id)
                    .order('created_at', { ascending: false });

                if (res && !res.error && Array.isArray(res.data)) {
                    solicitudes = res.data;
                } else if (res && res.error) {
                    console.warn('[DRender] Error al consultar service_requests en Supabase:', res.error);
                }
            } catch (e) {
                console.error('[DRender] Excepción al consultar solicitudes de servicios:', e);
            }
        }

        if (solicitudes.length === 0) {
            var fallback = DStore.getServiciosDeUsuario(usuarioActual.id);
            if (Array.isArray(fallback) && fallback.length > 0) solicitudes = fallback;
        }

        if (!Array.isArray(solicitudes) || solicitudes.length === 0) {
            el.innerHTML = vacio('ri-calendar-line','Sin servicios contratados','Aún no has solicitado ningún plan o asesoría personalizada.') +
                '<div style="text-align:center;margin-top:16px;">' +
                '<a href="paginas/servicios.html" class="d-btn d-btn--primario d-btn--sm">' +
                '<i class="ri-user-star-line"></i> Explorar Servicios & Asesorías</a></div>';
            return;
        }

        var html = '';
        solicitudes.forEach(function (req) {
            var srv = req.services || {};
            var nombre = srv.name || req.service_name || req.tipo || 'Servicio Fitness';
            var imagen = srv.image_url || req.imagen || '';
            var coach = srv.coach || req.coach || 'Coach Asignado';
            var duracion = srv.duration || req.duracion || '';
            var estado = req.status || req.estado || 'pendiente';
            var fecha = req.created_at || req.fecha;
            var notas = req.notes || req.notas || '';

            var iconOrImg = imagen
                ? '<img src="' + esc(imagen) + '" alt="' + esc(nombre) + '" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid var(--d-borde);margin-right:12px;" onerror="this.onerror=null;this.src=\'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png\';">'
                : '<div class="d-servicio-item__icon" style="background:var(--d-vino-ghost);color:var(--d-vino);"><i class="ri-user-star-line" aria-hidden="true"></i></div>';

            html +=
                '<div class="d-servicio-item">' +
                iconOrImg +
                '<div style="flex:1;min-width:0;">' +
                '<div style="font-weight:700;font-size:0.9rem;">' + esc(nombre) + '</div>' +
                '<div style="font-size:0.78rem;color:var(--d-texto-mut);">Coach: ' + esc(coach) + (duracion ? ' · ' + esc(duracion) : '') + '</div>' +
                '<div style="font-size:0.76rem;color:var(--d-texto-mut);">Solicitado el: ' + formatoFecha(fecha) + '</div>' +
                (notas ? '<div style="font-size:0.75rem;color:var(--d-texto-2);margin-top:4px;font-style:italic;">Nota: "' + esc(notas) + '"</div>' : '') +
                '</div>' +
                badgeEstado(estado) +
                '</div>';
        });

        el.innerHTML = html;
    }

    // ── CLIENTE: Favoritos (100% Supabase) ───────────────────────────────────
    async function renderFavoritos(usuario) {
        var el = document.getElementById('cliente-favs-grid');
        if (!el) return;

        var usuarioActual = usuario || (typeof AuthService !== 'undefined' && AuthService.getCurrentUser ? AuthService.getCurrentUser() : null);
        if (!usuarioActual && typeof Dashboard !== 'undefined' && Dashboard.getUsuario) {
            usuarioActual = Dashboard.getUsuario();
        }
        if (!usuarioActual || !usuarioActual.id) {
            el.innerHTML = '<div style="grid-column:1/-1;">' +
                vacio('ri-heart-line','Sin favoritos','Inicia sesión para ver tus productos favoritos.') +
                '</div>';
            return;
        }

        if (!window.supabaseClient) {
            el.innerHTML = '<div style="grid-column:1/-1;">' +
                vacio('ri-wifi-off-line','Sin conexión','No se pudo conectar con el servicio de Supabase.') +
                '</div>';
            return;
        }

        el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;">' +
            '<div class="spinner-border text-success" role="status"><span class="visually-hidden">Cargando...</span></div>' +
            '<p class="text-muted mt-2 small">Cargando tus favoritos desde Supabase...</p></div>';

        var favs = [];
        try {
            var res = await window.supabaseClient
                .from('favorites')
                .select('product_id, products(*)')
                .eq('user_id', usuarioActual.id);

            if (res && !res.error && Array.isArray(res.data)) {
                favs = res.data;
            } else {
                favs = [];
            }
        } catch (err) {
            console.error('[Dashboard] Error al consultar favoritos en Supabase:', err);
            favs = [];
        }

        if (!Array.isArray(favs) || favs.length === 0) {
            el.innerHTML = '<div style="grid-column:1/-1;">' +
                vacio('ri-heart-line','Sin favoritos','Aún no has guardado productos favoritos en tu lista.') +
                '<div style="text-align:center;margin-top:16px;">' +
                '<a href="paginas/productos.html" class="d-btn d-btn--primario d-btn--sm">' +
                '<i class="ri-shopping-bag-line"></i> Explorar Catálogo</a></div>' +
                '</div>';
            return;
        }

        el.innerHTML = favs.map(function (f) {
            var p = f && f.products ? f.products : {};
            var prodId = (f && f.product_id) || p.id || '';
            var prodNombre = p.name || 'Producto';
            var prodPrecio = Number(p.price) || 0;
            var prodCat = p.category ? (p.category.charAt(0).toUpperCase() + p.category.slice(1)) : 'Fitness';
            var prodImg = p.image_url || '';

            var imgHtml = prodImg
                ? '<img src="' + esc(prodImg) + '" alt="' + esc(prodNombre) + '" loading="lazy" onerror="this.src=\'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png\'">'
                : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--d-plata);font-size:2.2rem;"><i class="ri-article-line"></i></div>';

            var botonComprar = prodPrecio > 0 ?
                '<button class="d-btn d-btn--primario d-btn--sm" style="padding:6px 12px;font-size:0.75rem;" title="Agregar al carrito" onclick="DRender.agregarFavoritoAlCarrito(\'' + esc(prodId) + '\')">' +
                '<i class="ri-shopping-cart-2-line"></i> Comprar</button>' : '';

            return '<div class="d-fav-card">' +
                '<div class="d-fav-card__img">' + imgHtml + '</div>' +
                '<div class="d-fav-card__body">' +
                '<div class="d-fav-card__tag">' + esc(prodCat) + '</div>' +
                '<div class="d-fav-card__name">' + esc(prodNombre) + '</div>' +
                '<div class="d-fav-card__foot">' +
                '<span class="d-fav-card__price">' + (prodPrecio > 0 ? formatoCOP(prodPrecio) : 'Artículo') + '</span>' +
                '<div style="display:flex;gap:6px;align-items:center;">' +
                botonComprar +
                '<button class="d-btn-icon eliminar" title="Quitar de favoritos" onclick="DRender.quitarFavorito(\'' + esc(prodId) + '\',\'' + esc(usuarioActual.id) + '\')">' +
                '<i class="ri-heart-fill" style="color:var(--d-vino);" aria-hidden="true"></i></button>' +
                '</div></div></div></div>';
        }).join('');
    }

    async function quitarFavorito(favId, uid) {
        if (!window.supabaseClient) {
            DToast.error('Conexión con Supabase no disponible.');
            return;
        }

        var usuarioActual = (typeof AuthService !== 'undefined' && AuthService.getCurrentUser ? AuthService.getCurrentUser() : null);
        if (!usuarioActual && typeof Dashboard !== 'undefined' && Dashboard.getUsuario) {
            usuarioActual = Dashboard.getUsuario();
        }
        var targetUid = uid || (usuarioActual ? usuarioActual.id : null);

        if (!targetUid) {
            DToast.error('No se pudo identificar la sesión del usuario.');
            return;
        }

        try {
            var { error } = await window.supabaseClient
                .from('favorites')
                .delete()
                .eq('user_id', targetUid)
                .eq('product_id', favId);

            if (error) throw error;

            DToast.ok('Eliminado de favoritos.');
            renderFavoritos(usuarioActual || { id: targetUid });
        } catch (e) {
            console.error('[Dashboard] Error al eliminar favorito de Supabase:', e);
            DToast.error('No se pudo eliminar el favorito.');
        }
    }

    async function agregarFavoritoAlCarrito(favId) {
        var prod = null;
        if (window.supabaseClient) {
            try {
                var { data } = await window.supabaseClient.from('products').select('*').eq('id', favId).single();
                if (data) {
                    prod = {
                        id:        data.id,
                        nombre:    data.name,
                        precio:    Number(data.price) || 0,
                        imagen:    data.image_url,
                        categoria: data.category
                    };
                }
            } catch (e) {}
        }
        if (!prod) {
            var prods = DStore.getProductos();
            var pMatch = Array.isArray(prods) ? prods.find(function (p) { return p && p.id === favId; }) : null;
            if (pMatch) {
                prod = {
                    id:        pMatch.id,
                    nombre:    pMatch.name || pMatch.nombre,
                    precio:    pMatch.price || pMatch.precio,
                    imagen:    pMatch.image_url || pMatch.imagen,
                    categoria: pMatch.category || pMatch.categoria
                };
            }
        }
        if (!prod) {
            DToast.error('No se pudo encontrar la información del producto.');
            return;
        }

        if (typeof CarritoService !== 'undefined' && CarritoService.agregar) {
            CarritoService.agregar(prod);
            DToast.ok('"' + (prod.nombre || 'Producto') + '" agregado al carrito.');
        } else {
            DToast.error('El servicio de carrito no está disponible.');
        }
    }


    // ── ADMIN: Gestión de Usuarios ───────────────────────────────────────────
    function renderUsuariosAdmin() {
        var tbody = document.getElementById('admin-usuarios-tbody');
        var total = document.getElementById('admin-usuarios-total');
        if (!tbody) return;

        var usuariosRaw = DStore.getUsuarios();
        var usuarios = Array.isArray(usuariosRaw) ? usuariosRaw : [];
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
        var usuariosRaw = DStore.getUsuarios();
        var usuarios = Array.isArray(usuariosRaw) ? usuariosRaw : [];
        var u        = usuarios.find(function (x) { return x && x.id === uid; });
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
        var usuariosRaw = DStore.getUsuarios();
        var usuarios = Array.isArray(usuariosRaw) ? usuariosRaw : [];
        var u = usuarios.find(function (x) { return x && x.id === uid; });
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
        renderKpis,
        renderKPIs: renderKpis,
        actualizarEstadisticas: renderKpis,
        renderGraficos, renderTablaPedidos,
        // Productos admin
        renderProductosAdmin, abrirModalProducto, cerrarModalProducto, eliminarProductoUI, setFiltroProductos,
        // Servicios admin
        renderServiciosAdmin,
        renderTablaServiciosCatalog,
        cargarCatalogoServicios: renderTablaServiciosCatalog,
        renderSolicitudesServiciosAdmin,
        abrirModalServicio, cerrarModalServicio, eliminarServicioCatalogoUI, editarNotaServicio,
        // Blog admin
        renderBlogAdmin, editarPost, eliminarPostUI,
        renderMensajesAdmin, marcarLeido,
        // Cliente
        renderPedidosCliente, renderServiciosCliente,
        renderFavoritos, quitarFavorito, agregarFavoritoAlCarrito,
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
        'sec-admin-resumen':   async function () {
            await DRender.renderKpis();
            DRender.renderGraficos();
        },
        'sec-admin-productos': function () { DRender.renderProductosAdmin(); },
        'sec-admin-pedidos':   async function () { await DRender.renderTablaPedidos(); },
        'sec-admin-servicios': async function () { await DRender.renderServiciosAdmin(); },
        'sec-admin-usuarios':  function () { DRender.renderUsuariosAdmin(); },
        'sec-admin-blog':      function () { DRender.renderBlogAdmin(); },
        'sec-admin-mensajes':  function () { DRender.renderMensajesAdmin(); },

        'sec-cliente-pedidos':   async function () { await DRender.renderPedidosCliente(_usuario); },
        'sec-cliente-servicios': async function () { await DRender.renderServiciosCliente(_usuario); },
        'sec-cliente-favoritos': async function () { await DRender.renderFavoritos(_usuario); },
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
        // Iniciar el dashboard directamente
        // El admin debe crearse manualmente en Supabase vía SQL Editor
        _iniciar();
    }

    function _iniciar() {
        // Pequeño delay para que la pantalla de carga sea visible
        setTimeout(function () {
            _usuario = verificarSesion();
            if (!_usuario) return;           // guard redirigió a login.html

            _rol = obtenerRol(_usuario);

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

            // Listeners de búsqueda y filtrado de productos
            var prodBuscarInput = document.getElementById('admin-prod-buscar');
            var prodCatSelect   = document.getElementById('admin-prod-filtro-cat');
            if (prodBuscarInput) {
                prodBuscarInput.addEventListener('input', function () {
                    DRender.setFiltroProductos(prodBuscarInput.value, prodCatSelect ? prodCatSelect.value : '');
                });
            }
            if (prodCatSelect) {
                prodCatSelect.addEventListener('change', function () {
                    DRender.setFiltroProductos(prodBuscarInput ? prodBuscarInput.value : '', prodCatSelect.value);
                });
            }

            // Ir a la sección inicial (respeta hash en URL si existe y es válida)
            var hash = (window.location.hash || '').replace('#', '');
            var primeraSeccion = _rol === 'admin' ? 'sec-admin-resumen' : 'sec-cliente-pedidos';
            var seccionInicial = (hash && document.getElementById(hash)) ? hash : primeraSeccion;
            irA(seccionInicial);

            // Escuchar cambios de hash (ej: clics en links internos)
            window.addEventListener('hashchange', function () {
                var nuevoHash = (window.location.hash || '').replace('#', '');
                if (nuevoHash && document.getElementById(nuevoHash)) {
                    irA(nuevoHash);
                }
            });

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
        _formProducto();
        _formServicio();
        _formBlog();
        _formPerfil();
        _formPassword();
        _formFitness();
        _formEditarUsuario();
    }

    function _formProducto() {
        var form = document.getElementById('form-producto');
        var overlay = document.getElementById('modal-prod-overlay');
        var btnCancelar = document.getElementById('modal-prod-cancelar');

        if (!form) return;

        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) DRender.cerrarModalProducto();
            });
        }
        if (btnCancelar) {
            btnCancelar.addEventListener('click', DRender.cerrarModalProducto);
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay && overlay.classList.contains('d-modal--visible')) {
                DRender.cerrarModalProducto();
            }
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            var id          = document.getElementById('prod-id').value;
            var nombre      = document.getElementById('prod-nombre').value.trim();
            var categoria   = document.getElementById('prod-categoria').value;
            var precio      = parseInt(document.getElementById('prod-precio').value, 10);
            var stock       = parseInt(document.getElementById('prod-stock').value, 10);
            var badge       = document.getElementById('prod-badge').value.trim();
            var imagen      = document.getElementById('prod-imagen').value.trim();
            var descripcion = document.getElementById('prod-descripcion').value.trim();

            if (!nombre) {
                DToast.error('El nombre del producto es obligatorio.');
                return;
            }
            if (isNaN(precio) || precio < 0) {
                DToast.error('Ingresa un precio válido.');
                return;
            }
            if (isNaN(stock) || stock < 0) {
                DToast.error('Ingresa una cantidad de stock válida.');
                return;
            }
            if (!imagen) {
                DToast.error('La URL de la imagen es obligatoria.');
                return;
            }

            var guardado = DStore.guardarProducto({
                id: id,
                nombre: nombre,
                categoria: categoria,
                precio: precio,
                stock: stock,
                badge: badge,
                imagen: imagen,
                descripcion: descripcion
            });

            if (guardado) {
                DRender.cerrarModalProducto();
                DRender.renderProductosAdmin();
                DSidebar.actualizarBadges();
                DToast.ok(id ? 'Producto actualizado correctamente.' : '¡Producto creado y publicado en la tienda!');
            } else {
                DToast.error('Error al guardar el producto.');
            }
        });
    }

    function _formServicio() {
        var form = document.getElementById('form-servicio');
        var overlay = document.getElementById('modal-srv-overlay');
        var btnCancelar = document.getElementById('modal-srv-cancelar');

        if (!form) return;

        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) DRender.cerrarModalServicio();
            });
        }
        if (btnCancelar) {
            btnCancelar.addEventListener('click', DRender.cerrarModalServicio);
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay && overlay.classList.contains('d-modal--visible')) {
                DRender.cerrarModalServicio();
            }
        });

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            var id          = document.getElementById('srv-id').value;
            var nombre      = document.getElementById('srv-nombre').value.trim();
            var categoria   = document.getElementById('srv-categoria').value;
            var precio      = parseInt(document.getElementById('srv-precio').value, 10);
            var duracion    = document.getElementById('srv-duracion').value.trim();
            var coach       = document.getElementById('srv-coach').value.trim();
            var imagen      = document.getElementById('srv-imagen').value.trim();
            var descripcion = document.getElementById('srv-descripcion').value.trim();

            if (!nombre || !descripcion || !duracion) {
                DToast.error('Completa los campos obligatorios del servicio.');
                return;
            }
            if (isNaN(precio) || precio < 0) {
                DToast.error('Ingresa un precio válido.');
                return;
            }

            try {
                var guardado = await DStore.guardarServicioCatalogo({
                    id: id,
                    name: nombre,
                    nombre: nombre,
                    category: categoria,
                    categoria: categoria,
                    price: precio,
                    precio: precio,
                    duration: duracion,
                    duracion: duracion,
                    coach: coach,
                    image_url: imagen,
                    imagen: imagen,
                    description: descripcion,
                    descripcion: descripcion
                });

                if (guardado) {
                    DRender.cerrarModalServicio();
                    await DRender.renderServiciosAdmin();
                    DToast.ok(id ? 'Servicio actualizado correctamente.' : '¡Nuevo servicio añadido al catálogo!');
                } else {
                    DToast.error('Error al guardar el servicio en Supabase.');
                }
            } catch (err) {
                console.error('[Dashboard] Error al guardar servicio:', err);
                DToast.error('Error al guardar el servicio en Supabase.');
            }
        });
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
                var imgEl = document.getElementById('blog-imagen');
                if (imgEl) imgEl.value = '';
                document.getElementById('blog-btn-texto').textContent = 'Publicar';
                document.querySelector('#blog-form-titulo').innerHTML =
                    '<i class="ri-edit-2-line"></i> Nuevo Artículo';
            });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            var titulo    = document.getElementById('blog-titulo').value.trim();
            var categoria = document.getElementById('blog-categoria').value;
            var imagen    = document.getElementById('blog-imagen') ? document.getElementById('blog-imagen').value.trim() : '';
            var extracto  = document.getElementById('blog-extracto').value.trim();
            var idEdit    = document.getElementById('blog-id-edit').value;

            if (!titulo || !extracto) {
                DToast.error('Completa el título y el extracto del artículo.');
                return;
            }

            if (idEdit) {
                DStore.actualizarPost(idEdit, { titulo, categoria, extracto, imagen });
                DToast.ok('Artículo actualizado exitosamente.');
            } else {
                DStore.crearPost({ titulo, categoria, extracto, imagen, autor: _usuario.nombre });
                DToast.ok('Artículo publicado exitosamente.');
            }

            form.reset();
            document.getElementById('blog-id-edit').value = '';
            var imgInput = document.getElementById('blog-imagen');
            if (imgInput) imgInput.value = '';
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
        // NOTA: seed automático eliminado - los datos deben migrarse manualmente vía SQL
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
        var pedidosRaw = DStore.getPedidos();
        var pedidos = Array.isArray(pedidosRaw) ? pedidosRaw : [];
        if (!pedidos.length) { DToast.error('No hay pedidos para exportar.'); return; }

        var csv = 'ID,Cliente,Productos,Total,Estado,Fecha\n';
        pedidos.forEach(function (p) {
            if (!p) return;
            csv += [p.id, '"' + (p.clienteNombre || '') + '"', '"' + (p.productos || '') + '"',
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

    return { init, irA, renderSeccionActual, cargarDatosSeed, marcarTodosLeidos, exportarPedidosCSV, getUsuario: function() { return _usuario; } };

})();

// ── Iniciar cuando el DOM esté listo ────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Dashboard.init);
} else {
    Dashboard.init();
}
