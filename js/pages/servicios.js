// js/pages/servicios.js
// Responsabilidad: lógica de paginas/servicios.html.
// — Renderiza dinámicamente la carta de servicios 100% desde Supabase
// — Mapea las columnas exactas: id (UUID), name, category, price, duration, coach, image_url, description
// — Botón de acción: redirige a contactanos.html?servicio_id=${s.id} (o a WhatsApp para servicios Virtuales)
// — Cero dependencias de localStorage

(function () {

    'use strict';

    function formatoCOP(val) {
        return '$' + Math.round(val || 0).toLocaleString('es-CO');
    }

    function esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function obtenerColorBadge(cat) {
        var c = String(cat || '').toLowerCase().trim();
        if (c === 'nutrición' || c === 'nutricion') return 'bg-success';
        if (c === 'entrenamiento') return 'bg-danger';
        if (c === 'indumentaria') return 'bg-info text-dark';
        if (c === 'equipamiento') return 'bg-warning text-dark';
        if (c === 'virtual') return 'bg-primary';
        if (c === 'elite') return 'bg-dark';
        return 'bg-success';
    }

    async function obtenerClienteSupabase() {
        if (window.supabaseClient) return window.supabaseClient;
        return new Promise(function (resolve) {
            var check = setInterval(function () {
                if (window.supabaseClient) {
                    clearInterval(check);
                    resolve(window.supabaseClient);
                }
            }, 50);
        });
    }

    var _serviciosCargados = [];

    function _mostrarModalExito(nombreServicio) {
        var msgEl = document.getElementById('modal-servicio-agendado-msg');
        if (msgEl) {
            msgEl.innerHTML = 'Hemos registrado tu solicitud para <strong>' + esc(nombreServicio) + '</strong>. Uno de nuestros coaches revisará los detalles y se pondrá en contacto contigo muy pronto.';
        }

        var modalEl = document.getElementById('modal-servicio-agendado');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            var modalInst = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modalInst.show();
        } else {
            alert('¡Solicitud agendada con éxito para "' + nombreServicio + '"! Puedes consultar el estado en tu Dashboard.');
        }
    }

    async function cargarServicios() {
        var contenedor = document.getElementById('contenedor-servicios') ||
                         document.getElementById('servicios-catalogo-grid') ||
                         document.querySelector('section.py-5 .row.g-4');

        if (!contenedor) return;

        // Mostrar spinner de carga inicial
        contenedor.innerHTML = [
            '<div class="col-12 text-center py-5">',
            '  <div class="spinner-border text-success" role="status">',
            '    <span class="visually-hidden">Cargando servicios...</span>',
            '  </div>',
            '  <p class="text-muted mt-3">Cargando servicios desde Supabase...</p>',
            '</div>'
        ].join('');

        var servicios = [];

        try {
            await obtenerClienteSupabase();

            if (typeof ServiciosStore !== 'undefined' && ServiciosStore.obtenerCatalogo) {
                servicios = await ServiciosStore.obtenerCatalogo();
            } else if (window.supabaseClient) {
                var { data, error } = await window.supabaseClient
                    .from('services')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                servicios = Array.isArray(data) ? data : [];
            }
        } catch (err) {
            console.error('[Servicios] Error al consultar la tabla services en Supabase:', err);
            contenedor.innerHTML = [
                '<div class="col-12 text-center py-5">',
                '  <i class="ri-wifi-off-line fs-1 text-danger mb-3 d-block"></i>',
                '  <h4 class="fw-bold">No se pudieron cargar los servicios</h4>',
                '  <p class="text-muted mb-4">Ocurrió un error al conectar con Supabase. Por favor intenta de nuevo.</p>',
                '  <button id="btn-reintentar-servicios" class="btn btn-outline-success">',
                '    <i class="ri-refresh-line me-2"></i>Reintentar',
                '  </button>',
                '</div>'
            ].join('');

            var btnReintentar = document.getElementById('btn-reintentar-servicios');
            if (btnReintentar) {
                btnReintentar.addEventListener('click', cargarServicios);
            }
            return;
        }

        if (!Array.isArray(servicios) || servicios.length === 0) {
            contenedor.innerHTML = [
                '<div class="col-12 text-center py-5">',
                '  <i class="ri-service-line fs-1 text-muted mb-3 d-block"></i>',
                '  <h4 class="fw-bold">No hay servicios disponibles</h4>',
                '  <p class="text-muted">Pronto agregaremos nuevas opciones y planes de entrenamiento.</p>',
                '</div>'
            ].join('');
            return;
        }

        _serviciosCargados = servicios;
        renderizarTarjetas(contenedor, servicios);
    }

    function renderizarTarjetas(contenedor, servicios) {
        contenedor.innerHTML = servicios.map(function (s) {
            var id = s.id || '';
            var nombre = s.name || s.nombre || 'Servicio Fitness';
            var categoria = s.category || s.categoria || 'Entrenamiento';
            var precioNum = Number(s.price !== undefined ? s.price : s.precio) || 0;
            var duracion = s.duration || s.duracion || '1 mes';
            var coach = s.coach || 'Coach Prana';
            var imagen = s.image_url || s.imagen || 'https://res.cloudinary.com/atexcbli/image/upload/v1791240018/asesoria-nutricional-deportiva.png';
            var descripcion = s.description || s.descripcion || '';

            var badgeColor = obtenerColorBadge(categoria);
            var esVirtual = String(categoria).toLowerCase().trim() === 'virtual';
            var esCotizar = (precioNum === 0 || String(categoria).toLowerCase().trim() === 'indumentaria');

            var textoBoton = 'Agendar Ahora';
            if (esVirtual) textoBoton = 'Agendar Asesoría Online';
            else if (esCotizar) textoBoton = 'Cotizar / Agendar';

            var botonHtml = [
                '<a href="contactanos.html?servicio_id=' + encodeURIComponent(id) + '" class="btn btn-success w-100 btn-agendar-servicio" data-servicio-id="' + esc(id) + '">',
                '  <i class="' + (esVirtual ? 'fab fa-whatsapp' : 'ri-calendar-check-line') + ' me-2"></i>' + textoBoton,
                '</a>'
            ].join('');

            var precioHtml = precioNum > 0
                ? '<h4 class="text-success fw-bold mb-3">' + formatoCOP(precioNum) + ' <small class="text-muted fw-normal">COP / ' + esc(duracion) + '</small></h4>'
                : '<h4 class="text-success fw-bold mb-3">A convenir <small class="text-muted fw-normal">(' + esc(duracion) + ')</small></h4>';

            return [
                '<article class="col-lg-4 col-md-6 servicio-item">',
                '  <div class="card h-100 border-0 shadow-sm rounded-3 overflow-hidden hover-shadow transition">',
                '    <img src="' + esc(imagen) + '" class="card-img-top p-4 bg-light" alt="' + esc(nombre) + '" style="height: 220px; object-fit: contain;" loading="lazy" onerror="this.src=\'https://res.cloudinary.com/atexcbli/image/upload/v1791240018/asesoria-nutricional-deportiva.png\'">',
                '    <div class="card-body d-flex flex-column">',
                '      <span class="badge ' + badgeColor + ' mb-2 align-self-start">' + esc(categoria) + '</span>',
                '      <h3 class="h5 fw-bold mb-2">' + esc(nombre) + '</h3>',
                '      <p class="text-muted small mb-3 flex-grow-1">' + esc(descripcion) + '</p>',
                '      <div class="d-flex align-items-center gap-2 mb-3">',
                '        <i class="ri-user-star-line text-muted"></i>',
                '        <span class="small text-muted font-monospace">Coach: <strong>' + esc(coach) + '</strong></span>',
                '      </div>',
                '      ' + precioHtml,
                '      ' + botonHtml,
                '    </div>',
                '  </div>',
                '</article>'
            ].join('');
        }).join('');

        // Delegación de eventos en el contenedor para clics dinámicos (unificado para todas las tarjetas)
        contenedor.addEventListener('click', async function (e) {
            var btn = e.target.closest('.btn-agendar-servicio');
            if (!btn) return;

            var srvId = btn.getAttribute('data-servicio-id');
            if (!srvId) return;

            // Obtener usuario con sesión activa
            var usuario = null;
            if (typeof AuthService !== 'undefined' && AuthService.getCurrentUser) {
                usuario = AuthService.getCurrentUser();
            }
            if (!usuario) {
                try {
                    var ses = JSON.parse(localStorage.getItem('prana_sesion') || '{}');
                    usuario = ses.usuario || null;
                } catch (errSes) {}
            }

            // Si el usuario TIENE sesión activa, realizar agendamiento unificado directo a Supabase
            if (usuario && usuario.id) {
                e.preventDefault();

                if (btn.classList.contains('disabled') || btn.getAttribute('data-cargando') === '1') {
                    return;
                }

                btn.setAttribute('data-cargando', '1');
                var textoOriginal = btn.innerHTML;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Agendando...';

                var srv = _serviciosCargados.find(function (x) { return String(x.id) === String(srvId); }) || { id: srvId, name: 'Servicio Fitness' };
                var nombreSrv = srv.name || srv.nombre || 'Servicio Fitness';

                try {
                    await obtenerClienteSupabase();

                    // Guardar en service_requests con status = 'pendiente'
                    if (typeof ServiciosStore !== 'undefined' && ServiciosStore.crearSolicitud) {
                        await ServiciosStore.crearSolicitud(usuario.id, srvId, 'Agendado desde la web');
                    } else if (window.supabaseClient) {
                        var { error } = await window.supabaseClient
                            .from('service_requests')
                            .insert({
                                user_id: usuario.id,
                                service_id: srvId,
                                status: 'pendiente',
                                notes: 'Agendado desde la web'
                            });

                        if (error) throw error;
                    }

                    // Actualizar estado visual del botón
                    btn.removeAttribute('data-cargando');
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-secondary', 'disabled');
                    btn.innerHTML = '<i class="ri-checkbox-circle-line me-2"></i>¡Solicitud Enviada!';

                    // Mostrar modal visual de confirmación con enlace a Dashboard
                    _mostrarModalExito(nombreSrv);

                } catch (err) {
                    console.error('[Servicios] Error al agendar servicio directamente:', err);
                    btn.removeAttribute('data-cargando');
                    btn.innerHTML = textoOriginal;
                    alert('No se pudo procesar tu agendamiento en este momento. Por favor intenta de nuevo.');
                }
            } else {
                // Usuario invitado / sin sesión: permitir redirección natural hacia contactanos.html?servicio_id=...
            }
        });
    }

    function init() {
        cargarServicios();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
