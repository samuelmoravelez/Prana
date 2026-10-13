// js/pages/login.js
// Responsabilidad: gestionar la página de acceso INDEPENDIENTE (login.html).
// Maneja la alternancia de pestañas (Login / Registro), validaciones de
// formularios en tiempo real, integración con AuthService y redirección
// a index.html (o a la URL de retorno si el usuario venía del carrito).
//
// Dependencias: utils/storage.js, utils/hash.js, services/auth.js
// (todos cargados antes en login.html)

(function () {

    'use strict';

    // ── Clave de retorno (debe coincidir con carrito.js) ─────────────────────
    var KEY_RETORNO = 'prana_login_retorno';

    // ── Estado ──────────────────────────────────────────────────────────────
    var tabActiva = 'login'; // 'login' | 'registro'

    // ── Utilidades DOM ──────────────────────────────────────────────────────
    function $(id)         { return document.getElementById(id); }
    function qs(sel, ctx)  { return (ctx || document).querySelector(sel); }
    function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

    // ── Determinar URL de destino post-login ─────────────────────────────────
    // Prioridad: 1) parámetro ?retorno= en la URL actual
    //            2) sessionStorage[KEY_RETORNO] guardado por carrito.js
    //            3) index.html por defecto
    function obtenerUrlRetorno() {
        // 1. Parámetro en la URL actual
        try {
            var params  = new URLSearchParams(window.location.search);
            var retorno = params.get('retorno');
            if (retorno) {
                // Solo permitir URLs del mismo origen (seguridad: evitar open redirect)
                var url = new URL(retorno, window.location.origin);
                if (url.origin === window.location.origin) {
                    return url.href;
                }
            }
        } catch (e) { /* URL inválida o URLSearchParams no disponible */ }

        // 2. sessionStorage guardado por el carrito
        try {
            var guardada = sessionStorage.getItem(KEY_RETORNO);
            if (guardada) {
                var url2 = new URL(guardada, window.location.origin);
                if (url2.origin === window.location.origin) {
                    sessionStorage.removeItem(KEY_RETORNO); // consumir
                    return url2.href;
                }
            }
        } catch (e) { /* sessionStorage puede estar desactivado */ }

        // 3. Destino por defecto
        return 'index.html';
    }

    // ── Verificar sesión activa al cargar ───────────────────────────────────
    // Si el usuario ya está autenticado, lo redirigimos al destino correcto.
    // Si tiene rol 'admin', va al dashboard; si no, al destino de retorno.
    function redirigirSiAutenticado() {
        if (typeof AuthService !== 'undefined' && AuthService.estaAutenticado()) {
            var destino = obtenerUrlRetorno();
            // Si el destino es index.html (default) y el usuario es admin → dashboard
            if (destino === 'index.html' || destino.endsWith('/index.html')) {
                try {
                    var raw = localStorage.getItem('prana_sesion');
                    var ses = raw ? JSON.parse(raw) : null;
                    if (ses && ses.usuario && ses.usuario.role === 'admin') {
                        window.location.replace('dashboard.html');
                        return true;
                    }
                } catch (e) {}
            }
            window.location.replace(destino);
            return true;
        }
        return false;
    }

    // ── Activar pestaña de registro si viene ?registro=1 ────────────────────
    function activarTabPorParametro() {
        try {
            var params = new URLSearchParams(window.location.search);
            if (params.get('registro') === '1') {
                // Cambiar a la pestaña de registro después de que el DOM esté listo
                setTimeout(function () { cambiarTab('registro'); }, 100);
            }
        } catch (e) { /* silencioso */ }
    }

    // ── Alertas visuales ────────────────────────────────────────────────────
    var ICONOS_ALERTA = {
        error: 'ri-error-warning-fill',
        exito: 'ri-checkbox-circle-fill',
        info:  'ri-information-fill'
    };

    function mostrarAlerta(tipo, mensaje) {
        var contenedor = $('login-alertas');
        if (!contenedor) return;

        contenedor.innerHTML =
            '<div class="auth-alerta auth-alerta--' + tipo + '" role="alert">' +
                '<i class="' + (ICONOS_ALERTA[tipo] || ICONOS_ALERTA.info) + '" aria-hidden="true"></i>' +
                '<span>' + _escaparHTML(mensaje) + '</span>' +
            '</div>';

        // Auto-ocultar en 6s para errores informativos (no de validación)
        if (tipo !== 'error') {
            setTimeout(function () {
                var alerta = contenedor.firstChild;
                if (alerta) {
                    alerta.style.transition = 'opacity 0.4s ease';
                    alerta.style.opacity = '0';
                    setTimeout(function () { contenedor.innerHTML = ''; }, 400);
                }
            }, 6000);
        }
    }

    function limpiarAlertas() {
        var contenedor = $('login-alertas');
        if (contenedor) contenedor.innerHTML = '';
    }

    // Escape básico de HTML para evitar XSS en mensajes dinámicos
    function _escaparHTML(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Errores por campo ────────────────────────────────────────────────────
    function setError(campoId, mensaje) {
        var input    = $(campoId);
        var errorEl  = $(campoId + '-error');
        if (input) {
            if (mensaje) {
                input.classList.add('auth-input--error');
                input.setAttribute('aria-invalid', 'true');
            } else {
                input.classList.remove('auth-input--error');
                input.removeAttribute('aria-invalid');
            }
        }
        if (errorEl) errorEl.textContent = mensaje || '';
    }

    function limpiarErroresFormulario(formId) {
        var form = $(formId);
        if (!form) return;
        qsa('input', form).forEach(function (input) {
            input.classList.remove('auth-input--error');
            input.removeAttribute('aria-invalid');
        });
        qsa('.auth-error', form).forEach(function (el) {
            el.textContent = '';
        });
    }

    // ── Validaciones ─────────────────────────────────────────────────────────
    var REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function validarEmail(email) {
        return REGEX_EMAIL.test(String(email || '').trim());
    }

    function validarLogin(datos) {
        var errores = {};

        if (!datos.email.trim()) {
            errores.email = 'Ingresa tu correo electrónico.';
        } else if (!validarEmail(datos.email)) {
            errores.email = 'El correo no tiene un formato válido (ej. nombre@dominio.com).';
        }

        if (!datos.password) {
            errores.password = 'Ingresa tu contraseña.';
        }

        return errores;
    }

    function validarRegistro(datos) {
        var errores = {};

        if (!datos.nombre.trim()) {
            errores.nombre = 'Ingresa tu nombre completo.';
        } else if (datos.nombre.trim().length < 2) {
            errores.nombre = 'El nombre debe tener al menos 2 caracteres.';
        } else if (datos.nombre.trim().length > 80) {
            errores.nombre = 'El nombre no puede superar los 80 caracteres.';
        }

        if (!datos.email.trim()) {
            errores.email = 'Ingresa tu correo electrónico.';
        } else if (!validarEmail(datos.email)) {
            errores.email = 'El correo no tiene un formato válido (ej. nombre@dominio.com).';
        }

        if (!datos.password) {
            errores.password = 'Crea una contraseña.';
        } else if (datos.password.length < 6) {
            errores.password = 'La contraseña debe tener al menos 6 caracteres.';
        } else if (datos.password.length > 128) {
            errores.password = 'La contraseña no puede superar los 128 caracteres.';
        }

        if (!datos.passwordConfirm) {
            errores['password-confirm'] = 'Confirma tu contraseña.';
        } else if (datos.password !== datos.passwordConfirm) {
            errores['password-confirm'] = 'Las contraseñas no coinciden. Verifícalas.';
        }

        return errores;
    }

    function mostrarErrores(errores, prefijo) {
        Object.keys(errores).forEach(function (campo) {
            setError(prefijo + '-' + campo, errores[campo]);
        });
        // Hacer foco en el primer campo con error para accesibilidad
        var primeroConError = Object.keys(errores)[0];
        var inputFoco = $(prefijo + '-' + primeroConError);
        if (inputFoco) {
            inputFoco.focus();
        }
    }

    // ── Alternancia de pestañas ──────────────────────────────────────────────
    function cambiarTab(tab) {
        if (tabActiva === tab) return;
        tabActiva = tab;

        var tabs        = qsa('.auth-tab');
        var forms       = qsa('.auth-form');
        var footerTexto = $('login-footer-texto');

        tabs.forEach(function (t) {
            var activo = t.getAttribute('data-tab') === tab;
            t.classList.toggle('auth-tab--activo', activo);
            t.setAttribute('aria-selected', activo ? 'true' : 'false');
        });

        forms.forEach(function (f) {
            var activo = f.id === 'form-' + tab;
            f.classList.toggle('auth-form--activo', activo);
        });

        // Actualizar texto del pie de la tarjeta
        if (footerTexto) {
            if (tab === 'login') {
                footerTexto.innerHTML =
                    '¿No tienes cuenta? ' +
                    '<strong class="auth-link" data-tab-toggle="registro" style="cursor:pointer;">' +
                        'Regístrate aquí' +
                    '</strong>';
            } else {
                footerTexto.innerHTML =
                    '¿Ya tienes cuenta? ' +
                    '<strong class="auth-link" data-tab-toggle="login" style="cursor:pointer;">' +
                        'Inicia sesión aquí' +
                    '</strong>';
            }
        }

        limpiarAlertas();
        limpiarErroresFormulario('form-' + tab);
    }

    // ── Toggle de visibilidad de contraseña ──────────────────────────────────
    function configurarTogglePassword() {
        qsa('.auth-toggle-password').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var targetId = btn.getAttribute('data-target');
                var input    = $(targetId);
                if (!input) return;
                var icono    = qs('i', btn);

                var oculta = input.type === 'password';
                input.type = oculta ? 'text' : 'password';

                if (icono) {
                    icono.classList.toggle('ri-eye-line',     !oculta);
                    icono.classList.toggle('ri-eye-off-line',  oculta);
                }
                btn.setAttribute('aria-label', oculta ? 'Ocultar contraseña' : 'Mostrar contraseña');
            });
        });
    }

    // ── Limpiar error al escribir ─────────────────────────────────────────────
    function configurarLimpiezaErrores() {
        qsa('input[id]').forEach(function (input) {
            input.addEventListener('input', function () {
                input.classList.remove('auth-input--error');
                input.removeAttribute('aria-invalid');
                var errorEl = $(input.id + '-error');
                if (errorEl) errorEl.textContent = '';
            });
        });
    }

    // ── Validación en tiempo real del campo "confirmar contraseña" ────────────
    function configurarValidacionConfirmar() {
        var pwField        = $('registro-password');
        var confirmField   = $('registro-password-confirm');
        if (!pwField || !confirmField) return;

        confirmField.addEventListener('blur', function () {
            if (confirmField.value && pwField.value !== confirmField.value) {
                setError('registro-password-confirm', 'Las contraseñas no coinciden.');
            }
        });
    }

    // ── Estado de carga del botón ─────────────────────────────────────────────
    function setBotonCargando(btn, cargando, textoOriginal) {
        if (!btn) return;
        var textoEl = qs('.auth-submit-texto', btn);
        var spinner = qs('.auth-spinner', btn);

        btn.disabled = cargando;
        btn.classList.toggle('auth-submit--cargando', cargando);

        if (textoEl) textoEl.textContent = cargando ? 'Procesando...' : textoOriginal;
        if (spinner) spinner.style.display = cargando ? 'inline-block' : 'none';
    }

    // ── Manejo del formulario de Login ────────────────────────────────────────
    function manejarLogin(e) {
        e.preventDefault();
        limpiarAlertas();
        limpiarErroresFormulario('form-login');

        var email    = $('login-email').value.trim();
        var password = $('login-password').value;
        var btn      = $('login-submit');

        // Validar localmente antes de llamar al servicio
        var errores = validarLogin({ email: email, password: password });
        if (Object.keys(errores).length > 0) {
            mostrarErrores(errores, 'login');
            return;
        }

        setBotonCargando(btn, true, 'Iniciar Sesión');

        AuthService.iniciarSesion(email, password)
            .then(function (resultado) {
                setBotonCargando(btn, false, 'Iniciar Sesión');

                if (resultado.ok) {
                    var nombre = (resultado.usuario && resultado.usuario.nombre)
                                    ? resultado.usuario.nombre.split(' ')[0]
                                    : 'atleta';

                    var destino    = obtenerUrlRetorno();
                    var esCarrito  = destino.indexOf('carrito') !== -1;
                    var esDashDefault = (destino === 'index.html' || destino.endsWith('/index.html'));

                    // Admin sin destino específico → dashboard
                    if (esDashDefault && resultado.usuario && resultado.usuario.role === 'admin') {
                        destino = 'dashboard.html';
                    }

                    var msgExtra   = esCarrito
                        ? ' Redirigiendo a tu carrito...'
                        : destino.indexOf('dashboard') !== -1
                            ? ' Accediendo al panel de control...'
                            : ' Redirigiendo...';

                    mostrarAlerta('exito',
                        '¡Bienvenido de nuevo, ' + nombre + '!' + msgExtra);

                    setTimeout(function () {
                        window.location.href = destino;
                    }, 900);
                } else {
                    mostrarAlerta('error',
                        resultado.mensaje || 'No se pudo iniciar sesión. Verifica tus datos.');
                }
            })
            .catch(function () {
                setBotonCargando(btn, false, 'Iniciar Sesión');
                mostrarAlerta('error',
                    'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.');
            });
    }

    // ── Manejo del formulario de Registro ─────────────────────────────────────
    function manejarRegistro(e) {
        e.preventDefault();
        limpiarAlertas();
        limpiarErroresFormulario('form-registro');

        var nombre          = $('registro-nombre').value.trim();
        var email           = $('registro-email').value.trim();
        var password        = $('registro-password').value;
        var passwordConfirm = $('registro-password-confirm').value;
        var terminos        = $('registro-terminos');
        var btn             = $('registro-submit');

        // Validar campos del formulario
        var errores = validarRegistro({
            nombre:          nombre,
            email:           email,
            password:        password,
            passwordConfirm: passwordConfirm
        });

        // Validar aceptación de términos por separado (no está en validarRegistro)
        if (!terminos.checked) {
            mostrarAlerta('error',
                'Debes aceptar los términos y condiciones para crear tu cuenta.');
            if (Object.keys(errores).length > 0) {
                mostrarErrores(errores, 'registro');
            }
            return;
        }

        if (Object.keys(errores).length > 0) {
            mostrarErrores(errores, 'registro');
            return;
        }

        setBotonCargando(btn, true, 'Crear Cuenta');

        AuthService.registrar({
            nombre:   nombre,
            email:    email,
            password: password
        })
            .then(function (resultado) {
                setBotonCargando(btn, false, 'Crear Cuenta');

                if (resultado.ok) {
                    mostrarAlerta('exito',
                        resultado.mensaje || '¡Cuenta creada exitosamente! Ya puedes iniciar sesión.');

                    // Limpiar el formulario de registro
                    $('form-registro').reset();

                    // Cambiar a la pestaña de login tras un breve delay
                    setTimeout(function () {
                        cambiarTab('login');

                        // Pre-rellenar el email para mayor comodidad del usuario
                        var loginEmail = $('login-email');
                        if (loginEmail) loginEmail.value = email;

                        // Si viene del carrito, informarlo en el mensaje
                        var destino    = obtenerUrlRetorno();
                        var esCarrito  = destino.indexOf('carrito') !== -1;
                        var msgExtra   = esCarrito
                            ? ' Inicia sesión para volver a tu carrito.'
                            : ' Inicia sesión para continuar.';

                        mostrarAlerta('info',
                            'Tu cuenta fue creada exitosamente.' + msgExtra);
                    }, 1400);
                } else {
                    mostrarAlerta('error',
                        resultado.mensaje || 'No se pudo crear la cuenta. Inténtalo de nuevo.');
                }
            })
            .catch(function () {
                setBotonCargando(btn, false, 'Crear Cuenta');
                mostrarAlerta('error',
                    'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.');
            });
    }

    // ── Recuperación de contraseña (placeholder) ──────────────────────────────
    function manejarRecuperacion(e) {
        e.preventDefault();
        mostrarAlerta('info',
            'Para recuperar tu contraseña, escríbenos por WhatsApp o al correo soporte@prana.com.co');
    }

    // ── Inicialización ────────────────────────────────────────────────────────
    function init() {

        // Si ya hay sesión activa → redirigir al destino correcto
        if (redirigirSiAutenticado()) return;

        // Activar la pestaña correcta según parámetro URL (?registro=1)
        activarTabPorParametro();

        // Configurar pestañas mediante delegación de eventos
        qsa('.auth-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                cambiarTab(tab.getAttribute('data-tab'));
            });
        });

        // Delegación global para links "data-tab-toggle" (en footer y cualquier parte)
        document.addEventListener('click', function (e) {
            var toggle = e.target.closest('[data-tab-toggle]');
            if (toggle) {
                e.preventDefault();
                cambiarTab(toggle.getAttribute('data-tab-toggle'));
            }
        });

        // Toggle de contraseña
        configurarTogglePassword();

        // Limpieza de errores mientras se escribe
        configurarLimpiezaErrores();

        // Validación en tiempo real del campo de confirmación
        configurarValidacionConfirmar();

        // Submit de los formularios
        var formLogin    = $('form-login');
        var formRegistro = $('form-registro');
        if (formLogin)    formLogin.addEventListener('submit', manejarLogin);
        if (formRegistro) formRegistro.addEventListener('submit', manejarRegistro);

        // Link "¿Olvidaste tu contraseña?"
        var olvidaste = $('login-olvidaste');
        if (olvidaste) {
            olvidaste.addEventListener('click', manejarRecuperacion);
        }

        // Poner foco en el campo de email al cargar la página (UX)
        var emailInput = $('login-email');
        if (emailInput) {
            setTimeout(function () { emailInput.focus(); }, 350);
        }
    }

    // Ejecutar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
