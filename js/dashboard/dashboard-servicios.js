/**
 * js/dashboard/dashboard-servicios.js
 * Lógica CRUD del catálogo de la tabla `services` y solicitudes de clientes en `service_requests`.
 */

import {
    obtenerClienteSupabase,
    esc,
    formatoCOP,
    formatoFecha,
    badgeEstado,
    vacio,
    DToast,
    DSidebar,
    getUsuarios
} from './dashboard-common.js';
import { renderKpis } from './dashboard-kpis.js';

var _serviciosDashboardCache = [];
var _sincronizandoServiciosDashboard = false;
var _solicitudesServiciosCache = [];
var _sincronizandoSolicitudes = false;

// ── SERVICIOS CATÁLOGO (CRUD 100% Supabase) ──────────────────────────────────
export function getCatalogoServicios() {
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

export function setCatalogoServicios(arr) {
    if (Array.isArray(arr)) _serviciosDashboardCache = arr;
}

export async function guardarServicioCatalogo(datos) {
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

export async function eliminarServicioCatalogo(id) {
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

// ── SOLICITUDES DE SERVICIOS (service_requests) ──────────────────────────────
export function getServicios() {
    if (typeof window !== 'undefined' && window.supabaseClient && !_sincronizandoSolicitudes) {
        _sincronizandoSolicitudes = true;
        window.supabaseClient
            .from('service_requests')
            .select('*, services(*), users(name, email)')
            .order('created_at', { ascending: false })
            .then(function (res) {
                _sincronizandoSolicitudes = false;
                if (res && !res.error && Array.isArray(res.data)) {
                    var usuarios = getUsuarios();
                    _solicitudesServiciosCache = res.data.map(function (s) {
                        var srv = s.services || {};
                        var usr = s.users || (Array.isArray(usuarios) ? usuarios.find(function (u) { return String(u.id) === String(s.user_id); }) : null);
                        var clienteNombre = usr ? (usr.name || usr.nombre) : 'Cliente';
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

export function setServicios(s) {
    if (Array.isArray(s)) _solicitudesServiciosCache = s;
}

export function getServiciosDeUsuario(uid) {
    var lista = getServicios();
    if (!Array.isArray(lista) || !uid) return [];
    return lista.filter(function (s) { return s && String(s.userId) === String(uid); });
}

export async function actualizarEstadoServicio(id, estado) {
    if (typeof ServiciosStore !== 'undefined' && ServiciosStore.actualizarEstadoSolicitud) {
        await ServiciosStore.actualizarEstadoSolicitud(id, estado);
    } else {
        var supabase = await obtenerClienteSupabase();
        if (supabase) {
            await supabase.from('service_requests').update({ status: estado }).eq('id', id);
        }
    }
    var idx = _solicitudesServiciosCache.findIndex(function(s) { return s && String(s.id) === String(id); });
    if (idx >= 0) { _solicitudesServiciosCache[idx].estado = estado; }
}

export async function actualizarNotaServicio(id, notas) {
    if (typeof ServiciosStore !== 'undefined' && ServiciosStore.actualizarNota) {
        await ServiciosStore.actualizarNota(id, notas);
    } else {
        var supabase = await obtenerClienteSupabase();
        if (supabase) {
            await supabase.from('service_requests').update({ notes: notas }).eq('id', id);
        }
    }
    var idx = _solicitudesServiciosCache.findIndex(function(s) { return s && String(s.id) === String(id); });
    if (idx >= 0) { _solicitudesServiciosCache[idx].notas = notas; }
    return true;
}

// ── RENDER CATÁLOGO ADMIN ────────────────────────────────────────────────────
export async function renderTablaServiciosCatalog() {
    var catTbody = document.getElementById('admin-servicios-cat-tbody');
    var catTotal = document.getElementById('admin-servicios-cat-total');
    if (!catTbody) return;

    catTbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Cargando catálogo...</span></div></td></tr>';

    var servicios = [];
    try {
        var supabase = await obtenerClienteSupabase();
        if (supabase) {
            var { data, error } = await supabase
                .from('services')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[dashboard-servicios] Error al consultar services en Supabase:', error);
            } else if (Array.isArray(data)) {
                servicios = data;
            }
        }
    } catch (err) {
        console.error('[dashboard-servicios] Excepción al consultar catálogo de servicios:', err);
    }

    if (servicios.length === 0) {
        var fallback = getCatalogoServicios();
        if (Array.isArray(fallback) && fallback.length > 0) servicios = fallback;
    }

    setCatalogoServicios(servicios.map(function (s) {
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

export var cargarCatalogoServicios = renderTablaServiciosCatalog;

// ── RENDER SOLICITUDES ADMIN ─────────────────────────────────────────────────
export async function renderSolicitudesServiciosAdmin() {
    var el = document.getElementById('admin-servicios-list');
    var solTotal = document.getElementById('admin-solicitudes-total');
    if (!el) return;

    var servicios = [];
    try {
        var supabase = await obtenerClienteSupabase();
        if (supabase) {
            var res = await supabase
                .from('service_requests')
                .select('*, services(*), users(name, email)')
                .order('created_at', { ascending: false });

            if (res && !res.error && Array.isArray(res.data)) {
                var usuarios = getUsuarios();
                servicios = res.data.map(function (s) {
                    var srv = s.services || {};
                    var usr = s.users || (Array.isArray(usuarios) ? usuarios.find(function (u) { return String(u.id) === String(s.user_id); }) : null);
                    var clienteNombre = usr ? (usr.name || usr.nombre) : 'Cliente';
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
        console.warn('[dashboard-servicios] Error al consultar service_requests en admin:', e);
    }

    if (servicios.length === 0) {
        var fallback = getServicios();
        if (Array.isArray(fallback)) servicios = fallback;
    }

    if (solTotal) {
        var act = (Array.isArray(servicios) ? servicios.filter(function (x) {
            return x && (x.estado === 'pendiente' || x.estado === 'confirmado' || x.estado === 'activo');
        }) : []).length;
        solTotal.textContent = act + ' activa' + (act !== 1 ? 's' : '') + ' (' + servicios.length + ' total)';
    }

    if (servicios.length === 0) {
        el.innerHTML = vacio('ri-user-star-line', 'Sin solicitudes', 'No hay solicitudes de servicios registradas.');
        return;
    }

    var html = '';
    servicios.forEach(function (s) {
        var iconos = { 'Plan de Entrenamiento':'ri-run-line', 'Asesoría Nutricional':'ri-seedling-line', 'Reserva Showroom':'ri-store-2-line' };
        var ico    = iconos[s.tipo] || 'ri-user-star-line';
        var bgCol  = { activo:'var(--d-verde-bg)', confirmado:'rgba(14, 165, 233, 0.15)', pendiente:'var(--d-amarillo-bg)', completado:'var(--d-fondo)', cancelado:'var(--d-rojo-bg)' };
        var fgCol  = { activo:'var(--d-verde)', confirmado:'#0284c7', pendiente:'var(--d-amarillo)', completado:'var(--d-plata-dark)', cancelado:'var(--d-rojo)' };

        var mailBtn = s.clienteEmail ? 
            '<button class="d-btn-icon" title="Contactar por correo (' + esc(s.clienteEmail) + ')" onclick="window.open(\'mailto:' + esc(s.clienteEmail) + '\', \'_blank\')"><i class="ri-mail-line"></i></button>' : '';
        var notaBtn = '<button class="d-btn-icon" title="Editar / Agregar notas" onclick="DRender.editarNotaServicio(\'' + esc(s.id) + '\')"><i class="ri-file-edit-line"></i></button>';

        html +=
            '<div class="d-servicio-item">' +
            '<div class="d-servicio-item__icon" style="background:' + (bgCol[s.estado] || bgCol.pendiente) + ';color:' + (fgCol[s.estado] || fgCol.pendiente) + ';">' +
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
                return '<option value="' + e + '"' + (s.estado === e ? ' selected' : '') + '>' + (etiquetas[e] || e) + '</option>';
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
                await actualizarEstadoServicio(sel.dataset.srvId, sel.value);
                await renderSolicitudesServiciosAdmin();
                await renderKpis();
                DSidebar.actualizarBadges();
                DToast.ok('Estado de la solicitud actualizado.');
            } catch (e) {
                console.error('[dashboard-servicios] Error al actualizar estado de solicitud:', e);
                DToast.error('No se pudo actualizar el estado.');
            }
        });
    });
}

export async function renderServiciosAdmin() {
    await Promise.all([
        renderTablaServiciosCatalog(),
        renderSolicitudesServiciosAdmin()
    ]);
}

export async function editarNotaServicio(id) {
    var servicios = getServicios();
    var s = Array.isArray(servicios) ? servicios.find(function (x) { return x && String(x.id) === String(id); }) : null;
    if (!s) return;

    var nuevaNota = prompt('Editar o agregar notas de seguimiento para la solicitud de "' + (s.clienteNombre || 'Cliente') + '":', s.notas || '');
    if (nuevaNota === null) return;

    try {
        await actualizarNotaServicio(id, nuevaNota.trim());
        await renderSolicitudesServiciosAdmin();
        await renderKpis();
        DToast.ok('Notas de la solicitud actualizadas.');
    } catch (e) {
        console.error('[dashboard-servicios] Error al editar nota de servicio:', e);
        DToast.error('No se pudo actualizar la nota.');
    }
}

export function abrirModalServicio(id) {
    var form = document.getElementById('form-servicio');
    var overlay = document.getElementById('modal-srv-overlay');
    var tituloTxt = document.getElementById('modal-srv-titulo-txt');
    var btnGuardar = document.getElementById('srv-btn-guardar-txt');
    if (!form || !overlay) return;

    form.reset();

    if (id) {
        var cat = getCatalogoServicios();
        var s = Array.isArray(cat) ? cat.find(function (x) { return x && String(x.id) === String(id); }) : null;
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

export function cerrarModalServicio() {
    var overlay = document.getElementById('modal-srv-overlay');
    if (overlay) {
        overlay.classList.remove('d-modal--visible');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

export async function eliminarServicioCatalogoUI(id) {
    var cat = getCatalogoServicios();
    var s = Array.isArray(cat) ? cat.find(function (x) { return x && String(x.id) === String(id); }) : null;
    if (!s) return;
    var ejecutarEliminacion = async function () {
        try {
            await eliminarServicioCatalogo(id);
            await renderTablaServiciosCatalog();
            DToast.ok('Servicio eliminado del catálogo.');
        } catch (e) {
            DToast.error('No se pudo eliminar el servicio.');
        }
    };

    if (typeof ModalConfirmacion !== 'undefined' && ModalConfirmacion.confirmarEliminacion) {
        ModalConfirmacion.confirmarEliminacion({
            titulo: 'Eliminar servicio del catálogo',
            nombre: s.name || s.nombre || 'Servicio sin nombre',
            identificador: s.id,
            detalles: [
                { etiqueta: 'Categoría', valor: s.category || s.categoria || 'Sin categoría' },
                { etiqueta: 'Precio', valor: formatoCOP(s.price !== undefined ? s.price : (s.precio || 0)) },
                { etiqueta: 'Duración', valor: s.duration || s.duracion || 'No especificada' },
                { etiqueta: 'Coach', valor: s.coach || 'No asignado' }
            ],
            advertencia: '¿Eliminar este servicio del catálogo? Los clientes ya no podrán solicitarlo. Esta acción no se puede deshacer.',
            onConfirmar: ejecutarEliminacion
        });
        return;
    }

    try {
        await eliminarServicioCatalogo(id);
        await renderTablaServiciosCatalog();
        DToast.ok('Servicio eliminado del catálogo.');
    } catch (e) {
        DToast.error('No se pudo eliminar el servicio.');
    }
}

// ── RENDER CLIENTE: Mis Servicios ────────────────────────────────────────────
export async function renderServiciosCliente(usuario) {
    var el = document.getElementById('cliente-servicios-list');
    if (!el) return;

    var usuarioActual = usuario || (typeof AuthService !== 'undefined' && AuthService.getCurrentUser ? AuthService.getCurrentUser() : null);
    if (!usuarioActual && typeof window.Dashboard !== 'undefined' && window.Dashboard.getUsuario) {
        usuarioActual = window.Dashboard.getUsuario();
    }
    if (!usuarioActual || !usuarioActual.id) {
        el.innerHTML = vacio('ri-user-unfollow-line', 'Sesión no iniciada', 'Inicia sesión para ver tus servicios.');
        return;
    }

    el.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="spinner-border text-success" role="status"></div></div>';

    var solicitudes = [];
    try {
        var supabase = await obtenerClienteSupabase();
        if (supabase) {
            var res = await supabase
                .from('service_requests')
                .select('*, services(*)')
                .eq('user_id', usuarioActual.id)
                .order('created_at', { ascending: false });

            if (res && !res.error && Array.isArray(res.data)) {
                solicitudes = res.data;
            } else if (res && res.error) {
                console.warn('[dashboard-servicios] Error al consultar service_requests en Supabase:', res.error);
            }
        }
    } catch (e) {
        console.error('[dashboard-servicios] Excepción al consultar solicitudes de servicios:', e);
    }

    if (solicitudes.length === 0) {
        var fallback = getServiciosDeUsuario(usuarioActual.id);
        if (Array.isArray(fallback) && fallback.length > 0) solicitudes = fallback;
    }

    if (!Array.isArray(solicitudes) || solicitudes.length === 0) {
        el.innerHTML = vacio('ri-calendar-line', 'Sin servicios contratados', 'Aún no has solicitado ningún plan o asesoría personalizada.') +
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

// ── CONFIGURACIÓN DEL FORMULARIO DE SERVICIOS ────────────────────────────────
export function configurarFormServicio() {
    var form = document.getElementById('form-servicio');
    var overlay = document.getElementById('modal-srv-overlay');
    var btnCancelar = document.getElementById('modal-srv-cancelar');

    if (!form) return;

    if (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) cerrarModalServicio();
        });
    }
    if (btnCancelar) {
        btnCancelar.addEventListener('click', cerrarModalServicio);
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay && overlay.classList.contains('d-modal--visible')) {
            cerrarModalServicio();
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
            var guardado = await guardarServicioCatalogo({
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
                cerrarModalServicio();
                await renderServiciosAdmin();
                DToast.ok(id ? 'Servicio actualizado correctamente.' : '¡Nuevo servicio añadido al catálogo!');
            } else {
                DToast.error('Error al guardar el servicio en Supabase.');
            }
        } catch (err) {
            console.error('[dashboard-servicios] Error al guardar servicio:', err);
            DToast.error('Error al guardar el servicio en Supabase.');
        }
    });
}
