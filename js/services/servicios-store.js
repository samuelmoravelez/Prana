// js/services/servicios-store.js
// ============================================================================
// SERVICIO CENTRALIZADO DE SERVICIOS — Prana Fitness
// ============================================================================
// Gestiona el catálogo de servicios ofrecidos 100% en Supabase (PostgreSQL)
// y las solicitudes de servicios de los clientes.
//
// NOTA: Este servicio funciona exclusivamente con Supabase. No hay fallback a localStorage.
// ============================================================================

var ServiciosStore = (function () {

    'use strict';

    // Caché en memoria para acceso síncrono ultra-rápido en vistas y componentes
    var _cacheServicios = [];
    var _cargandoCatalogo = false;

    /**
     * Mapea un registro crudo de la tabla 'services' de Supabase
     * garantizando los tipos y alias esperados por la app.
     */
    function _mapearServicio(s) {
        if (!s) return null;
        var p = Number(s.price);
        return {
            id:          s.id,
            name:        s.name || 'Servicio Fitness',
            nombre:      s.name || 'Servicio Fitness',
            category:    s.category || 'Entrenamiento',
            categoria:   s.category || 'Entrenamiento',
            price:       isNaN(p) ? 0 : p,
            precio:      isNaN(p) ? 0 : p,
            duration:    s.duration || '1 mes',
            duracion:    s.duration || '1 mes',
            coach:       s.coach || 'Coach Prana',
            image_url:   s.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/v1791240018/asesoria-nutricional-deportiva.png',
            imagen:      s.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/v1791240018/asesoria-nutricional-deportiva.png',
            description: s.description || '',
            descripcion: s.description || '',
            created_at:  s.created_at,
            creadoEn:    s.created_at,
            updated_at:  s.updated_at,
            actualizadoEn: s.updated_at
        };
    }

    // ── CATÁLOGO DE SERVICIOS (Supabase Real) ────────────────────────────────
    /**
     * Consulta la tabla 'services' de Supabase y actualiza la caché local.
     * @returns {Promise<Array>} Lista de servicios mapeados
     */
    async function obtenerCatalogo() {
        if (!window.supabaseClient) {
            console.warn('[ServiciosStore] Supabase client no inicializado.');
            return _cacheServicios;
        }

        try {
            _cargandoCatalogo = true;
            var { data, error } = await window.supabaseClient
                .from('services')
                .select('*')
                .order('created_at', { ascending: false });

            _cargandoCatalogo = false;

            if (error) {
                console.error('[ServiciosStore] Error al obtener catálogo de servicios de Supabase:', error);
                return _cacheServicios;
            }

            if (!data || data.length === 0) {
                _cacheServicios = [];
                return [];
            }

            _cacheServicios = data.map(_mapearServicio).filter(Boolean);
            return _cacheServicios;
        } catch (e) {
            _cargandoCatalogo = false;
            console.error('[ServiciosStore] Excepción al obtener catálogo:', e);
            return _cacheServicios;
        }
    }

    /**
     * Retorna la caché de servicios de forma síncrona.
     * @returns {Array}
     */
    function obtenerCatalogoSync() {
        return Array.isArray(_cacheServicios) ? _cacheServicios : [];
    }

    /**
     * Guarda o actualiza un servicio en Supabase.
     * @param {Object} datos
     */
    async function guardarServicio(datos) {
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        var id = datos.id ? String(datos.id).trim() : '';

        // Payload exacto según columnas de la tabla 'services' de Supabase
        var servicioNormalizado = {
            name:        String(datos.name || datos.nombre || '').trim(),
            category:    String(datos.category || datos.categoria || 'Entrenamiento').trim(),
            duration:    String(datos.duration || datos.duracion || '1 mes').trim(),
            price:       Math.max(0, parseInt(datos.price !== undefined ? datos.price : datos.precio, 10) || 0),
            coach:       String(datos.coach || 'Coach Prana').trim(),
            description: String(datos.description || datos.descripcion || '').trim(),
            image_url:   String(datos.image_url || datos.imagen || 'https://res.cloudinary.com/atexcbli/image/upload/v1791240018/asesoria-nutricional-deportiva.png').trim()
        };

        try {
            var res;
            if (id) {
                res = await window.supabaseClient
                    .from('services')
                    .update(servicioNormalizado)
                    .eq('id', id)
                    .select()
                    .single();
            } else {
                res = await window.supabaseClient
                    .from('services')
                    .insert(servicioNormalizado)
                    .select()
                    .single();
            }

            if (res.error) {
                throw new Error('Error al guardar servicio en Supabase: ' + res.error.message);
            }

            var guardado = _mapearServicio(res.data);
            if (guardado) {
                var idx = _cacheServicios.findIndex(function (x) { return x.id === guardado.id; });
                if (idx >= 0) {
                    _cacheServicios[idx] = guardado;
                } else {
                    _cacheServicios.unshift(guardado);
                }
            }

            return guardado;
        } catch (e) {
            console.error('[ServiciosStore] Error al guardar servicio:', e);
            throw e;
        }
    }

    /**
     * Elimina un servicio en Supabase por ID.
     * @param {string} id
     */
    async function eliminarServicio(id) {
        if (!id) throw new Error('ID de servicio requerido');
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        try {
            var { error } = await window.supabaseClient
                .from('services')
                .delete()
                .eq('id', id);

            if (error) {
                throw new Error('Error al eliminar servicio en Supabase: ' + error.message);
            }

            _cacheServicios = _cacheServicios.filter(function (s) { return s.id !== id; });
            return true;
        } catch (e) {
            console.error('[ServiciosStore] Error al eliminar servicio:', e);
            throw e;
        }
    }

    // ── SOLICITUDES DE SERVICIOS (service_requests) ──────────────────────────
    /**
     * Obtiene todas las solicitudes registradas (Admin).
     */
    async function obtenerSolicitudes() {
        if (!window.supabaseClient) {
            return [];
        }

        try {
            var { data, error } = await window.supabaseClient
                .from('service_requests')
                .select('*, services(*)')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[ServiciosStore] Error al obtener solicitudes:', error);
                return [];
            }

            if (!Array.isArray(data)) return [];

            return data.map(function (s) {
                var srv = s.services || {};
                return {
                    id:            s.id,
                    userId:        s.user_id,
                    servicioId:    s.service_id,
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
        } catch (e) {
            console.error('[ServiciosStore] Error al obtener solicitudes:', e);
            return [];
        }
    }

    /**
     * Obtiene las solicitudes de un usuario específico (Cliente).
     * @param {string} uid
     */
    async function obtenerSolicitudesUsuario(uid) {
        if (!window.supabaseClient || !uid) {
            return [];
        }

        try {
            var { data, error } = await window.supabaseClient
                .from('service_requests')
                .select('*, services(*)')
                .eq('user_id', uid)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[ServiciosStore] Error al obtener solicitudes de usuario:', error);
                return [];
            }

            if (!Array.isArray(data)) return [];

            return data.map(function (s) {
                var srv = s.services || {};
                return {
                    id:            s.id,
                    userId:        s.user_id,
                    servicioId:    s.service_id,
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
        } catch (e) {
            console.error('[ServiciosStore] Error al obtener solicitudes de usuario:', e);
            return [];
        }
    }

    /**
     * Crea una nueva solicitud en service_requests.
     * @param {Object|string} usuario Objeto de usuario o UID
     * @param {Object|string} servicio Objeto de servicio o UUID del servicio
     * @param {string} notas Detalle o mensaje adjunto a la solicitud
     */
    async function crearSolicitud(usuario, servicio, notas) {
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        var uid = (usuario && usuario.id) ? usuario.id : (typeof usuario === 'string' ? usuario : ('invitado_' + Date.now()));
        var sid = (servicio && servicio.id) ? servicio.id : servicio;

        var solicitudNormalizada = {
            user_id:    uid,
            service_id: sid,
            status:     'pendiente',
            notes:      notas || ''
        };

        try {
            var { data, error } = await window.supabaseClient
                .from('service_requests')
                .insert(solicitudNormalizada)
                .select('*, services(*)')
                .single();

            if (error) {
                throw new Error('Error al crear solicitud en Supabase: ' + error.message);
            }

            var srv = (data && data.services) || (typeof servicio === 'object' ? servicio : {}) || {};
            return {
                id:         data.id,
                userId:     data.user_id,
                servicioId: data.service_id,
                tipo:       srv.name || srv.nombre || 'Servicio Fitness',
                nombre:     srv.name || srv.nombre || 'Servicio Fitness',
                coach:      srv.coach || 'Coach Asignado',
                duracion:   srv.duration || srv.duracion || '1 mes',
                estado:     data.status,
                notas:      data.notes || '',
                fecha:      data.created_at,
                inicio:     null
            };
        } catch (e) {
            console.error('[ServiciosStore] Error al crear solicitud:', e);
            throw e;
        }
    }

    /**
     * Actualiza el estado de una solicitud (Admin).
     */
    async function actualizarEstadoSolicitud(id, nuevoEstado) {
        if (!id) throw new Error('ID de solicitud requerido');
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        try {
            var { error } = await window.supabaseClient
                .from('service_requests')
                .update({ status: nuevoEstado })
                .eq('id', id);

            if (error) {
                throw new Error('Error al actualizar estado en Supabase: ' + error.message);
            }

            return true;
        } catch (e) {
            console.error('[ServiciosStore] Error al actualizar estado de solicitud:', e);
            throw e;
        }
    }

    /**
     * Actualiza las notas de una solicitud (Admin).
     */
    async function actualizarNota(id, notas) {
        if (!id) throw new Error('ID de solicitud requerido');
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        try {
            var { error } = await window.supabaseClient
                .from('service_requests')
                .update({ notes: notas })
                .eq('id', id);

            if (error) {
                throw new Error('Error al actualizar nota en Supabase: ' + error.message);
            }

            return true;
        } catch (e) {
            console.error('[ServiciosStore] Error al actualizar nota de solicitud:', e);
            throw e;
        }
    }

    // Inicializar carga asíncrona si Supabase está listo
    if (typeof window !== 'undefined' && window.supabaseClient) {
        obtenerCatalogo().catch(function () {});
    }

    return {
        obtenerCatalogo:           obtenerCatalogo,
        obtenerCatalogoSync:       obtenerCatalogoSync,
        guardarServicio:           guardarServicio,
        eliminarServicio:          eliminarServicio,
        obtenerSolicitudes:        obtenerSolicitudes,
        obtenerSolicitudesUsuario: obtenerSolicitudesUsuario,
        crearSolicitud:            crearSolicitud,
        actualizarEstadoSolicitud: actualizarEstadoSolicitud,
        actualizarNota:            actualizarNota
    };

})();
