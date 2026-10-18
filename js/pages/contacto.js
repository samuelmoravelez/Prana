// js/pages/contacto.js
// Responsabilidad: lógica exclusiva de contactanos.html.
// — Procesa el parámetro ?servicio_id=${id} enviado desde la carta de servicios
// — Preselecciona el asunto y precarga la información del servicio desde Supabase
// — Gestiona el envío del formulario y registro de solicitudes de servicio

(function () {

    'use strict';

    function formatoCOP(val) {
        return '$' + Math.round(val || 0).toLocaleString('es-CO');
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

    async function precargarServicioDesdeURL() {
        var params = new URLSearchParams(window.location.search);
        var servicioId = params.get('servicio_id');
        if (!servicioId) return;

        var servicio = null;

        await obtenerClienteSupabase();

        if (typeof ServiciosStore !== 'undefined' && ServiciosStore.obtenerCatalogo) {
            try {
                var catalogo = await ServiciosStore.obtenerCatalogo();
                servicio = Array.isArray(catalogo)
                    ? catalogo.find(function (s) { return String(s.id) === String(servicioId); })
                    : null;
            } catch (e) {}
        }

        if (!servicio && window.supabaseClient) {
            try {
                var { data } = await window.supabaseClient
                    .from('services')
                    .select('*')
                    .eq('id', servicioId)
                    .single();
                if (data) servicio = data;
            } catch (e) {}
        }

        if (!servicio) return;

        var nombre = servicio.name || servicio.nombre || 'Servicio Fitness';
        var precio = Number(servicio.price !== undefined ? servicio.price : servicio.precio) || 0;
        var duracion = servicio.duration || servicio.duracion || '1 mes';

        // Preseleccionar en el dropdown de asunto
        var selectAsunto = document.getElementById('asunto');
        if (selectAsunto) {
            var opcionExiste = false;
            for (var i = 0; i < selectAsunto.options.length; i++) {
                if (selectAsunto.options[i].value === 'servicio_' + servicioId) {
                    selectAsunto.selectedIndex = i;
                    opcionExiste = true;
                    break;
                }
            }
            if (!opcionExiste) {
                var nuevaOpcion = document.createElement('option');
                nuevaOpcion.value = 'servicio_' + servicioId;
                nuevaOpcion.textContent = 'Agendar: ' + nombre;
                nuevaOpcion.selected = true;
                selectAsunto.appendChild(nuevaOpcion);
            }
        }

        // Precargar en el campo de mensaje
        var textareaMensaje = document.getElementById('mensaje');
        if (textareaMensaje && !textareaMensaje.value.trim()) {
            var precioTexto = precio > 0 ? (' (' + formatoCOP(precio) + ' COP / ' + duracion + ')') : '';
            textareaMensaje.value = '¡Hola! Deseo agendar el servicio "' + nombre + '"' + precioTexto + '. Por favor indíquenme disponibilidad para iniciar.';
        }

        // Mostrar un banner visual en la cabecera del formulario
        var formulario = document.querySelector('form.needs-validation');
        if (formulario && !document.getElementById('banner-servicio-seleccionado')) {
            var banner = document.createElement('div');
            banner.id = 'banner-servicio-seleccionado';
            banner.className = 'alert alert-success d-flex align-items-center mb-4';
            banner.setAttribute('role', 'alert');
            banner.innerHTML = [
                '<i class="ri-checkbox-circle-fill fs-4 me-2 text-success"></i>',
                '<div>',
                '  <strong>Servicio seleccionado:</strong> ' + nombre + (precio > 0 ? ' &bull; ' + formatoCOP(precio) + ' / ' + duracion : ''),
                '</div>'
            ].join('');
            formulario.parentNode.insertBefore(banner, formulario);
        }
    }

    function inicializarFormulario() {
        var formulario = document.querySelector('form.needs-validation');
        if (!formulario) return;

        formulario.addEventListener('submit', async function (event) {
            event.preventDefault();
            event.stopPropagation();

            if (!formulario.checkValidity()) {
                formulario.classList.add('was-validated');
                return;
            }

            formulario.classList.add('was-validated');

            var btnSubmit = formulario.querySelector('button[type="submit"]');
            var textoOriginal = btnSubmit ? btnSubmit.innerHTML : '';
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando mensaje...';
            }

            var nombre = (document.getElementById('nombre') || {}).value || '';
            var email = (document.getElementById('email') || {}).value || '';
            var telefono = (document.getElementById('telefono') || {}).value || '';
            var asunto = (document.getElementById('asunto') || {}).value || '';
            var mensaje = (document.getElementById('mensaje') || {}).value || '';

            var params = new URLSearchParams(window.location.search);
            var servicioId = params.get('servicio_id');
            if (!servicioId && asunto && asunto.indexOf('servicio_') === 0) {
                servicioId = asunto.replace('servicio_', '');
            }

            try {
                await obtenerClienteSupabase();

                // Registrar solicitud en service_requests si el contacto corresponde a un servicio
                if (servicioId) {
                    var usuario = (typeof AuthService !== 'undefined' && AuthService.getCurrentUser) ? AuthService.getCurrentUser() : null;
                    var uid = (usuario && usuario.id) ? usuario.id : ('invitado_' + (email ? email.toLowerCase().replace(/[^a-z0-9]/g, '_') : Date.now()));
                    var detalleNota = 'Solicitante: ' + nombre + ' | Email: ' + email + (telefono ? ' | Tel: ' + telefono : '') + ' | Mensaje: ' + mensaje;

                    if (typeof ServiciosStore !== 'undefined' && ServiciosStore.crearSolicitud) {
                        await ServiciosStore.crearSolicitud({ id: uid }, { id: servicioId }, detalleNota);
                    } else if (window.supabaseClient) {
                        var { error: reqError } = await window.supabaseClient
                            .from('service_requests')
                            .insert({
                                user_id: uid,
                                service_id: servicioId,
                                status: 'pendiente',
                                notes: detalleNota
                            });
                        if (reqError) console.warn('[Contacto] Error al registrar service_request en Supabase:', reqError);
                    }
                }

                // Guardar en bandeja de mensajes de contacto para el dashboard
                try {
                    var rawMsgs = localStorage.getItem('prana_messages');
                    var msgs = [];
                    if (rawMsgs) msgs = JSON.parse(rawMsgs);
                    if (!Array.isArray(msgs)) msgs = [];
                    msgs.unshift({
                        id: 'msg_' + Date.now(),
                        nombre: nombre,
                        email: email,
                        telefono: telefono,
                        asunto: asunto,
                        mensaje: mensaje,
                        fecha: new Date().toISOString(),
                        leido: false
                    });
                    localStorage.setItem('prana_messages', JSON.stringify(msgs));
                } catch (eMsgs) {}

                formulario.reset();
                formulario.classList.remove('was-validated');

                if (btnSubmit) {
                    btnSubmit.innerHTML = '<i class="ri-checkbox-circle-line me-2"></i>¡Mensaje enviado con éxito!';
                    btnSubmit.classList.replace('btn-success', 'btn-secondary');
                }

                alert('¡Gracias ' + nombre + '! Hemos recibido tu solicitud. Te contactaremos pronto.');

                setTimeout(function () {
                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = textoOriginal;
                        btnSubmit.classList.replace('btn-secondary', 'btn-success');
                    }
                }, 3500);

            } catch (err) {
                console.error('[Contacto] Error al enviar formulario:', err);
                alert('No se pudo enviar tu mensaje. Por favor intenta de nuevo.');
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = textoOriginal;
                }
            }
        }, false);
    }

    function init() {
        precargarServicioDesdeURL();
        inicializarFormulario();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
