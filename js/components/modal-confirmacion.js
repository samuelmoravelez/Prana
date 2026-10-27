/**
 * js/components/modal-confirmacion.js
 * Componente global de confirmaciones para Prana Fitness.
 * 
 * Funcionalidades:
 * 1. Confirmación de eliminación con cuenta regresiva obligatoria de 5 segundos.
 *    - Modal HTML integrado con Bootstrap 5.
 *    - Título explicativo.
 *    - Nombre e identificador del elemento.
 *    - Datos relevantes para su reconocimiento.
 *    - Advertencia sobre la acción irreversible.
 *    - Botón «Cancelar».
 *    - Botón «Confirmar eliminación» bloqueado por 5s con cuenta regresiva visible.
 *    - Prevención de envíos duplicados y reinicio automático de temporizadores.
 * 
 * 2. Confirmación de cierre de sesión.
 *    - Modal Bootstrap con mensaje de confirmación.
 *    - Botón «Cancelar» (mantiene sesión activa).
 *    - Botón «Cerrar sesión» habilitado de forma inmediata (sin temporizador).
 */

(function (window, document) {
    'use strict';

    var _timerInterval = null;
    var _segundosRestantes = 5;
    var _callbackConfirmarEliminar = null;
    var _callbackCancelarEliminar = null;
    var _eliminacionEnProceso = false;

    var _callbackConfirmarLogout = null;
    var _logoutEnProceso = false;

    // Instancias de modales de Bootstrap (si la librería está disponible)
    var _bsModalEliminar = null;
    var _bsModalLogout = null;

    /**
     * Escapa caracteres HTML para prevenir inyección XSS.
     * @param {string} str
     * @returns {string}
     */
    function esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Inyecta las plantillas HTML de los modales en el DOM si aún no existen.
     */
    function _asegurarModalesEnDOM() {
        if (!document.getElementById('modalConfirmacionEliminar')) {
            var elEliminar = document.createElement('div');
            elEliminar.innerHTML = [
                '<div class="modal fade modal-confirmacion" id="modalConfirmacionEliminar" tabindex="-1" aria-labelledby="modalEliminarTituloTxt" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">',
                '  <div class="modal-dialog modal-dialog-centered">',
                '    <div class="modal-content shadow-lg border-0">',
                '      <div class="modal-header">',
                '        <h5 class="modal-title" id="modalEliminarTituloTxt">',
                '          <i class="ri-error-warning-fill text-danger fs-4" aria-hidden="true"></i>',
                '          <span id="modalEliminarTituloLabel">Confirmar eliminación</span>',
                '        </h5>',
                '        <button type="button" class="btn-close" id="btnCerrarXEliminar" aria-label="Cerrar"></button>',
                '      </div>',
                '      <div class="modal-body">',
                '        <div class="modal-alerta-adv mb-3" role="alert">',
                '          <i class="ri-alert-line" aria-hidden="true"></i>',
                '          <div>',
                '            <strong class="d-block mb-1">Advertencia de seguridad</strong>',
                '            <span id="modalEliminarAdvertencia">Esta acción no se puede deshacer y el elemento se eliminará permanentemente.</span>',
                '          </div>',
                '        </div>',
                '        <div class="modal-info-card">',
                '          <div class="modal-info-card__tag">Elemento a eliminar</div>',
                '          <div class="modal-info-card__nombre" id="modalEliminarNombre">Nombre del elemento</div>',
                '          <div class="modal-info-card__id" id="modalEliminarId">ID: #000</div>',
                '          <div id="modalEliminarDetallesContenedor"></div>',
                '        </div>',
                '        <div class="d-flex align-items-center gap-2 text-muted small" id="modalEliminarAvisoTiempo">',
                '          <i class="ri-time-line text-warning fs-5" aria-hidden="true"></i>',
                '          <span id="modalEliminarAvisoTiempoTxt">Espera 5 segundos para poder confirmar la eliminación.</span>',
                '        </div>',
                '      </div>',
                '      <div class="modal-footer">',
                '        <button type="button" class="btn-modal-cancelar" id="btnCancelarEliminacion">Cancelar</button>',
                '        <button type="button" class="btn-modal-eliminar" id="btnConfirmarEliminacion" disabled>',
                '          <i class="ri-time-line" id="btnConfirmarEliminarIcono" aria-hidden="true"></i>',
                '          <span id="btnConfirmarEliminarTexto">Confirmar eliminación (5s)</span>',
                '        </button>',
                '      </div>',
                '    </div>',
                '  </div>',
                '</div>'
            ].join('\n');
            document.body.appendChild(elEliminar.firstElementChild);
        }

        if (!document.getElementById('modalConfirmacionLogout')) {
            var elLogout = document.createElement('div');
            elLogout.innerHTML = [
                '<div class="modal fade modal-confirmacion" id="modalConfirmacionLogout" tabindex="-1" aria-labelledby="modalLogoutTituloTxt" aria-hidden="true">',
                '  <div class="modal-dialog modal-dialog-centered">',
                '    <div class="modal-content shadow-lg border-0">',
                '      <div class="modal-header">',
                '        <h5 class="modal-title" id="modalLogoutTituloTxt">',
                '          <i class="ri-logout-box-r-line text-danger fs-4" aria-hidden="true"></i>',
                '          <span>Confirmar cierre de sesión</span>',
                '        </h5>',
                '        <button type="button" class="btn-close" id="btnCerrarXLogout" aria-label="Cerrar"></button>',
                '      </div>',
                '      <div class="modal-body">',
                '        <div class="d-flex align-items-center gap-3 py-2">',
                '          <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(92, 10, 27, 0.1); color: #5C0A1B; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 1.4rem;">',
                '            <i class="ri-question-line" aria-hidden="true"></i>',
                '          </div>',
                '          <div>',
                '            <p class="mb-1 fw-bold fs-6 text-dark">¿Estás seguro de que deseas cerrar sesión?</p>',
                '            <p class="mb-0 text-muted small">Tu sesión actual finalizará y deberás ingresar nuevamente con tus credenciales.</p>',
                '          </div>',
                '        </div>',
                '      </div>',
                '      <div class="modal-footer">',
                '        <button type="button" class="btn-modal-cancelar" id="btnCancelarLogout">Cancelar</button>',
                '        <button type="button" class="btn-modal-logout" id="btnConfirmarLogout">',
                '          <i class="ri-logout-box-r-line" aria-hidden="true"></i>',
                '          <span>Cerrar sesión</span>',
                '        </button>',
                '      </div>',
                '    </div>',
                '  </div>',
                '</div>'
            ].join('\n');
            document.body.appendChild(elLogout.firstElementChild);
        }

        _vincularEventosEstaticos();
    }

    /**
     * Vincula los listeners de cancelación y cierre de los modales.
     */
    function _vincularEventosEstaticos() {
        var btnCancelarElim = document.getElementById('btnCancelarEliminacion');
        var btnCerrarXElim = document.getElementById('btnCerrarXEliminar');
        var modalElimEl = document.getElementById('modalConfirmacionEliminar');

        if (btnCancelarElim && !btnCancelarElim._vinculado) {
            btnCancelarElim._vinculado = true;
            btnCancelarElim.addEventListener('click', function (e) {
                e.preventDefault();
                _cancelarEliminacion();
            });
        }

        if (btnCerrarXElim && !btnCerrarXElim._vinculado) {
            btnCerrarXElim._vinculado = true;
            btnCerrarXElim.addEventListener('click', function (e) {
                e.preventDefault();
                _cancelarEliminacion();
            });
        }

        var btnConfirmarElim = document.getElementById('btnConfirmarEliminacion');
        if (btnConfirmarElim && !btnConfirmarElim._vinculado) {
            btnConfirmarElim._vinculado = true;
            btnConfirmarElim.addEventListener('click', function (e) {
                e.preventDefault();
                if (btnConfirmarElim.disabled || _segundosRestantes > 0 || _eliminacionEnProceso) {
                    return;
                }
                _ejecutarConfirmacionEliminar();
            });
        }

        // Eventos Logout
        var btnCancelarLog = document.getElementById('btnCancelarLogout');
        var btnCerrarXLog = document.getElementById('btnCerrarXLogout');
        var btnConfirmarLog = document.getElementById('btnConfirmarLogout');

        if (btnCancelarLog && !btnCancelarLog._vinculado) {
            btnCancelarLog._vinculado = true;
            btnCancelarLog.addEventListener('click', function (e) {
                e.preventDefault();
                _ocultarModalLogout();
            });
        }

        if (btnCerrarXLog && !btnCerrarXLog._vinculado) {
            btnCerrarXLog._vinculado = true;
            btnCerrarXLog.addEventListener('click', function (e) {
                e.preventDefault();
                _ocultarModalLogout();
            });
        }

        if (btnConfirmarLog && !btnConfirmarLog._vinculado) {
            btnConfirmarLog._vinculado = true;
            btnConfirmarLog.addEventListener('click', function (e) {
                e.preventDefault();
                if (_logoutEnProceso) return;
                _logoutEnProceso = true;
                btnConfirmarLog.disabled = true;
                _ocultarModalLogout();
                if (typeof _callbackConfirmarLogout === 'function') {
                    _callbackConfirmarLogout();
                }
            });
        }

        // Listener nativo de Bootstrap para cuando el modal se oculta por otros medios (ESC / backdrop)
        if (modalElimEl && !modalElimEl._vinculadoBs) {
            modalElimEl._vinculadoBs = true;
            modalElimEl.addEventListener('hidden.bs.modal', function () {
                _limpiarTemporizador();
                if (!_eliminacionEnProceso && typeof _callbackCancelarEliminar === 'function') {
                    _callbackCancelarEliminar();
                }
                _callbackConfirmarEliminar = null;
                _callbackCancelarEliminar = null;
            });
        }
    }

    /**
     * Muestra un modal utilizando Bootstrap 5 o el controlador fallback integrado.
     * @param {HTMLElement} el
     * @returns {Object}
     */
    function _mostrarModal(el) {
        if (window.bootstrap && window.bootstrap.Modal) {
            var inst = window.bootstrap.Modal.getInstance(el) || new window.bootstrap.Modal(el, {
                backdrop: 'static',
                keyboard: false
            });
            inst.show();
            return inst;
        } else {
            // Fallback manual compatible si Bootstrap JS no está cargado
            el.classList.add('show');
            el.style.display = 'block';
            el.removeAttribute('aria-hidden');
            el.setAttribute('aria-modal', 'true');
            document.body.classList.add('modal-open');

            var backdrop = document.getElementById('modal-fallback-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.id = 'modal-fallback-backdrop';
                backdrop.className = 'modal-backdrop fade show modal-confirmacion-backdrop';
                document.body.appendChild(backdrop);
            }
            return {
                hide: function () {
                    _ocultarModalFallback(el);
                }
            };
        }
    }

    /**
     * Oculta el modal de eliminación.
     */
    function _ocultarModalEliminar() {
        var el = document.getElementById('modalConfirmacionEliminar');
        if (!el) return;
        if (window.bootstrap && window.bootstrap.Modal) {
            var inst = window.bootstrap.Modal.getInstance(el);
            if (inst) inst.hide();
        } else {
            _ocultarModalFallback(el);
        }
    }

    /**
     * Oculta el modal de logout.
     */
    function _ocultarModalLogout() {
        var el = document.getElementById('modalConfirmacionLogout');
        if (!el) return;
        if (window.bootstrap && window.bootstrap.Modal) {
            var inst = window.bootstrap.Modal.getInstance(el);
            if (inst) inst.hide();
        } else {
            _ocultarModalFallback(el);
        }
    }

    function _ocultarModalFallback(el) {
        el.classList.remove('show');
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
        el.removeAttribute('aria-modal');
        document.body.classList.remove('modal-open');
        var backdrop = document.getElementById('modal-fallback-backdrop');
        if (backdrop && backdrop.parentNode) {
            backdrop.parentNode.removeChild(backdrop);
        }
    }

    /**
     * Limpia el temporizador de cuenta regresiva activo.
     */
    function _limpiarTemporizador() {
        if (_timerInterval) {
            clearInterval(_timerInterval);
            _timerInterval = null;
        }
    }

    /**
     * Cancela la eliminación y cierra el modal sin alterar nada.
     */
    function _cancelarEliminacion() {
        _limpiarTemporizador();
        _eliminacionEnProceso = false;
        _ocultarModalEliminar();
        if (typeof _callbackCancelarEliminar === 'function') {
            _callbackCancelarEliminar();
        }
        _callbackConfirmarEliminar = null;
        _callbackCancelarEliminar = null;
    }

    /**
     * Ejecuta la confirmación tras completarse la cuenta regresiva.
     */
    function _ejecutarConfirmacionEliminar() {
        _eliminacionEnProceso = true;
        _limpiarTemporizador();

        var btnConfirmar = document.getElementById('btnConfirmarEliminacion');
        if (btnConfirmar) {
            btnConfirmar.disabled = true; // Prevenir doble clic / solicitud duplicada
            var icono = document.getElementById('btnConfirmarEliminarIcono');
            var texto = document.getElementById('btnConfirmarEliminarTexto');
            if (icono) icono.className = 'spinner-border spinner-border-sm me-1';
            if (texto) texto.textContent = 'Eliminando...';
        }

        var callback = _callbackConfirmarEliminar;
        _callbackConfirmarEliminar = null;
        _callbackCancelarEliminar = null;

        _ocultarModalEliminar();

        if (typeof callback === 'function') {
            try {
                callback();
            } catch (err) {
                console.error('[ModalConfirmacion] Error al ejecutar confirmación de eliminación:', err);
            }
        }
    }

    /**
     * Abre la ventana de confirmación antes de eliminar cualquier elemento.
     * 
     * @param {Object} opciones
     * @param {string} opciones.titulo - Título que indica la confirmación de eliminación.
     * @param {string} opciones.nombre - Nombre del elemento que se pretende eliminar.
     * @param {string|number} [opciones.identificador] - Identificador único del elemento.
     * @param {Array<{etiqueta: string, valor: string}>} [opciones.detalles] - Datos relevantes para reconocerlo.
     * @param {string} [opciones.advertencia] - Advertencia sobre la acción irreversible.
     * @param {Function} opciones.onConfirmar - Función a ejecutar si el usuario confirma tras los 5 segundos.
     * @param {Function} [opciones.onCancelar] - Función a ejecutar si el usuario cancela.
     */
    function confirmarEliminacion(opciones) {
        opciones = opciones || {};
        _asegurarModalesEnDOM();

        // Reiniciar cualquier temporizador o estado previo
        _limpiarTemporizador();
        _eliminacionEnProceso = false;
        _segundosRestantes = 5;
        _callbackConfirmarEliminar = opciones.onConfirmar || null;
        _callbackCancelarEliminar = opciones.onCancelar || null;

        // Elementos del modal
        var tituloLabel = document.getElementById('modalEliminarTituloLabel');
        var nombreEl = document.getElementById('modalEliminarNombre');
        var idEl = document.getElementById('modalEliminarId');
        var advertenciaEl = document.getElementById('modalEliminarAdvertencia');
        var detallesContenedor = document.getElementById('modalEliminarDetallesContenedor');
        var avisoTiempoTxt = document.getElementById('modalEliminarAvisoTiempoTxt');
        var btnConfirmar = document.getElementById('btnConfirmarEliminacion');
        var btnConfirmarIcono = document.getElementById('btnConfirmarEliminarIcono');
        var btnConfirmarTexto = document.getElementById('btnConfirmarEliminarTexto');

        // Configurar título
        if (tituloLabel) {
            tituloLabel.textContent = opciones.titulo || 'Confirmar eliminación';
        }

        // Configurar nombre
        if (nombreEl) {
            nombreEl.textContent = opciones.nombre || 'Elemento seleccionado';
        }

        // Configurar identificador
        if (idEl) {
            if (opciones.identificador !== undefined && opciones.identificador !== null && String(opciones.identificador).trim() !== '') {
                idEl.textContent = 'ID: #' + String(opciones.identificador);
                idEl.style.display = 'inline-block';
            } else {
                idEl.style.display = 'none';
            }
        }

        // Configurar advertencia
        if (advertenciaEl) {
            advertenciaEl.textContent = opciones.advertencia ||
                'Esta acción no se puede deshacer y el elemento se eliminará permanentemente de la base de datos.';
        }

        // Renderizar datos relevantes disponibles
        if (detallesContenedor) {
            detallesContenedor.innerHTML = '';
            var detalles = Array.isArray(opciones.detalles) ? opciones.detalles : [];
            if (detalles.length > 0) {
                detalles.forEach(function (d) {
                    if (!d || !d.etiqueta) return;
                    var fila = document.createElement('div');
                    fila.className = 'modal-info-card__detalle-fila';
                    fila.innerHTML = '<span class="modal-info-card__detalle-label">' + esc(d.etiqueta) + ':</span>' +
                                     '<span class="modal-info-card__detalle-val">' + esc(d.valor || 'N/A') + '</span>';
                    detallesContenedor.appendChild(fila);
                });
            }
        }

        // Configurar botón de confirmación bloqueado a 5 segundos
        if (btnConfirmar) {
            btnConfirmar.disabled = true;
            if (btnConfirmarIcono) btnConfirmarIcono.className = 'ri-time-line';
            if (btnConfirmarTexto) btnConfirmarTexto.textContent = 'Confirmar eliminación (5s)';
        }

        if (avisoTiempoTxt) {
            avisoTiempoTxt.textContent = 'Por seguridad, el botón de confirmación se habilitará en 5 segundos.';
        }

        // Iniciar cuenta regresiva visible de cinco segundos
        _timerInterval = setInterval(function () {
            _segundosRestantes--;

            if (_segundosRestantes > 0) {
                if (btnConfirmarTexto) {
                    btnConfirmarTexto.textContent = 'Confirmar eliminación (' + _segundosRestantes + 's)';
                }
                if (avisoTiempoTxt) {
                    avisoTiempoTxt.textContent = 'Por seguridad, el botón de confirmación se habilitará en ' + _segundosRestantes + ' segundo' + (_segundosRestantes !== 1 ? 's' : '') + '.';
                }
            } else {
                // Fin de los 5 segundos: habilitar botón
                _limpiarTemporizador();
                if (btnConfirmar) {
                    btnConfirmar.disabled = false;
                }
                if (btnConfirmarIcono) {
                    btnConfirmarIcono.className = 'ri-delete-bin-6-line';
                }
                if (btnConfirmarTexto) {
                    btnConfirmarTexto.textContent = 'Confirmar eliminación';
                }
                if (avisoTiempoTxt) {
                    avisoTiempoTxt.innerHTML = '<span class="text-danger fw-bold"><i class="ri-checkbox-circle-line me-1"></i> Puedes confirmar la eliminación ahora.</span>';
                }
            }
        }, 1000);

        // Mostrar modal
        var modalEl = document.getElementById('modalConfirmacionEliminar');
        if (modalEl) {
            _mostrarModal(modalEl);
        }
    }

    /**
     * Abre la ventana de confirmación antes de cerrar sesión.
     * Inmediatamente habilitada, sin temporizador.
     * 
     * @param {Function} onConfirmar - Procedimiento de cierre de sesión a ejecutar.
     */
    function confirmarLogout(onConfirmar) {
        _asegurarModalesEnDOM();

        _logoutEnProceso = false;
        _callbackConfirmarLogout = onConfirmar;

        var btnConfirmar = document.getElementById('btnConfirmarLogout');
        if (btnConfirmar) {
            btnConfirmar.disabled = false; // Inmediatamente habilitado
            btnConfirmar.innerHTML = '<i class="ri-logout-box-r-line me-1" aria-hidden="true"></i> Cerrar sesión';
        }

        var modalEl = document.getElementById('modalConfirmacionLogout');
        if (modalEl) {
            _mostrarModal(modalEl);
        }
    }

    // Inicializar modales en DOM cuando el documento esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _asegurarModalesEnDOM);
    } else {
        _asegurarModalesEnDOM();
    }

    // Exportar API global
    window.ModalConfirmacion = {
        confirmarEliminacion: confirmarEliminacion,
        confirmarLogout:      confirmarLogout,
        cancelar:             _cancelarEliminacion
    };

})(window, document);
