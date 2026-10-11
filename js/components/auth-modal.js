// js/components/auth-modal.js
// Responsabilidad: renderizar y gestionar el modal de Login / Registro.
// Inyecta el HTML del modal en el DOM, alterna entre pestañas, valida
// formularios en tiempo real y se comunica con AuthService.
//
// Dependencias: services/auth.js (cargado antes).

var AuthModal = (function () {

    'use strict';

    // ── Estado del modal ────────────────────────────────────────────────────
    var modal = null;
    var tabActiva = 'login'; // 'login' | 'registro'
    var esVisible = false;

    // ── Inyección del HTML del modal ────────────────────────────────────────

    function construirHTML() {
        return [
            '<div class="auth-overlay" id="auth-overlay" aria-hidden="true">',
            '  <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-titulo">',
            '    <!-- Botón cerrar -->',
            '    <button type="button" class="auth-cerrar" id="auth-cerrar" aria-label="Cerrar">',
            '      <i class="ri-close-line"></i>',
            '    </button>',
            '',
            '    <!-- Encabezado con logo y título -->',
            '    <div class="auth-header">',
            '      <img src="https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png" alt="Logo Prana Fitness" class="auth-logo">',
            '      <h2 class="auth-titulo" id="auth-titulo">Bienvenido a Prana</h2>',
            '      <p class="auth-subtitulo">Tu tienda fitness de rendimiento</p>',
            '    </div>',
            '',
            '    <!-- Pestañas Login / Registro -->',
            '    <div class="auth-tabs">',
            '      <button type="button" class="auth-tab auth-tab--activo" data-tab="login" id="auth-tab-login">Iniciar Sesión</button>',
            '      <button type="button" class="auth-tab" data-tab="registro" id="auth-tab-registro">Crear Cuenta</button>',
            '    </div>',
            '',
            '    <!-- Área de alertas -->',
            '    <div class="auth-alertas" id="auth-alertas" aria-live="polite"></div>',
            '',
            '    <!-- Formulario de Login -->',
            '    <form class="auth-form auth-form--activo" id="auth-form-login" novalidate>',
            '      <div class="auth-campo">',
            '        <label for="login-email">Correo electrónico</label>',
            '        <div class="auth-input-wrapper">',
            '          <i class="ri-mail-line auth-input-icono"></i>',
            '          <input type="email" id="login-email" name="email" placeholder="tucorreo@ejemplo.com" autocomplete="email" required>',
            '        </div>',
            '        <small class="auth-error" id="login-email-error"></small>',
            '      </div>',
            '',
            '      <div class="auth-campo">',
            '        <label for="login-password">Contraseña</label>',
            '        <div class="auth-input-wrapper">',
            '          <i class="ri-lock-line auth-input-icono"></i>',
            '          <input type="password" id="login-password" name="password" placeholder="••••••••" autocomplete="current-password" required>',
            '          <button type="button" class="auth-toggle-password" data-target="login-password" aria-label="Mostrar contraseña">',
            '            <i class="ri-eye-line"></i>',
            '          </button>',
            '        </div>',
            '        <small class="auth-error" id="login-password-error"></small>',
            '      </div>',
            '',
            '      <div class="auth-extra">',
            '        <label class="auth-recordar">',
            '          <input type="checkbox" id="login-recordar">',
            '          <span>Recordarme</span>',
            '        </label>',
            '        <a href="#" class="auth-link" id="auth-olvidaste">¿Olvidaste tu contraseña?</a>',
            '      </div>',
            '',
            '      <button type="submit" class="auth-submit" id="login-submit">',
            '        <span class="auth-submit-texto">Iniciar Sesión</span>',
            '        <span class="auth-spinner" aria-hidden="true"></span>',
            '      </button>',
            '    </form>',
            '',
            '    <!-- Formulario de Registro -->',
            '    <form class="auth-form" id="auth-form-registro" novalidate>',
            '      <div class="auth-campo">',
            '        <label for="registro-nombre">Nombre completo</label>',
            '        <div class="auth-input-wrapper">',
            '          <i class="ri-user-line auth-input-icono"></i>',
            '          <input type="text" id="registro-nombre" name="nombre" placeholder="Tu nombre" autocomplete="name" required>',
            '        </div>',
            '        <small class="auth-error" id="registro-nombre-error"></small>',
            '      </div>',
            '',
            '      <div class="auth-campo">',
            '        <label for="registro-email">Correo electrónico</label>',
            '        <div class="auth-input-wrapper">',
            '          <i class="ri-mail-line auth-input-icono"></i>',
            '          <input type="email" id="registro-email" name="email" placeholder="tucorreo@ejemplo.com" autocomplete="email" required>',
            '        </div>',
            '        <small class="auth-error" id="registro-email-error"></small>',
            '      </div>',
            '',
            '      <div class="auth-campo">',
            '        <label for="registro-password">Contraseña</label>',
            '        <div class="auth-input-wrapper">',
            '          <i class="ri-lock-line auth-input-icono"></i>',
            '          <input type="password" id="registro-password" name="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password" required>',
            '          <button type="button" class="auth-toggle-password" data-target="registro-password" aria-label="Mostrar contraseña">',
            '            <i class="ri-eye-line"></i>',
            '          </button>',
            '        </div>',
            '        <small class="auth-error" id="registro-password-error"></small>',
            '      </div>',
            '',
            '      <div class="auth-campo">',
            '        <label for="registro-password2">Confirmar contraseña</label>',
            '        <div class="auth-input-wrapper">',
            '          <i class="ri-lock-2-line auth-input-icono"></i>',
            '          <input type="password" id="registro-password2" name="password2" placeholder="Repite tu contraseña" autocomplete="new-password" required>',
            '          <button type="button" class="auth-toggle-password" data-target="registro-password2" aria-label="Mostrar contraseña">',
            '            <i class="ri-eye-line"></i>',
            '          </button>',
            '        </div>',
            '        <small class="auth-error" id="registro-password2-error"></small>',
            '      </div>',
            '',
            '      <div class="auth-terminos">',
            '        <label class="auth-recordar">',
            '          <input type="checkbox" id="registro-terminos" required>',
            '          <span>Acepto los <a href="#" class="auth-link">términos y condiciones</a> y la <a href="#" class="auth-link">política de privacidad</a></span>',
            '        </label>',
            '      </div>',
            '',
            '      <button type="submit" class="auth-submit" id="registro-submit">',
            '        <span class="auth-submit-texto">Crear Cuenta</span>',
            '        <span class="auth-spinner" aria-hidden="true"></span>',
            '      </button>',
            '    </form>',
            '',
            '    <!-- Pie del modal -->',
            '    <div class="auth-footer">',
            '      <p>Al continuar aceptas las políticas de <strong>Prana Fitness</strong>.</p>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n');
    }

    // ── Inyección en el DOM ─────────────────────────────────────────────────

    function inyectarModal() {
        if (document.getElementById('auth-overlay')) return;
        var wrapper = document.createElement('div');
        wrapper.innerHTML = construirHTML();
        document.body.appendChild(wrapper.firstElementChild);
        modal = document.getElementById('auth-overlay');
    }

    // ── Mostrar / ocultar ───────────────────────────────────────────────────

    function abrir(pestana) {
        if (!modal) inyectarModal();
        tabActiva = pestana || 'login';
        cambiarPestana(tabActiva);
        modal.classList.add('auth-overlay--visible');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        esVisible = true;
        limpiarAlertas();
        limpiarFormularios();
        // Enfocar el primer campo
        setTimeout(function () {
            var primerInput = modal.querySelector('.auth-form--activo input:not([type="checkbox"])');
            if (primerInput) primerInput.focus();
        }, 100);
    }

    function cerrar() {
        if (!modal) return;
        modal.classList.remove('auth-overlay--visible');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        esVisible = false;
    }

    // ── Pestañas ────────────────────────────────────────────────────────────

    function cambiarPestana(pestana) {
        tabActiva = pestana;
        var tabs = modal.querySelectorAll('.auth-tab');
        tabs.forEach(function (tab) {
            tab.classList.toggle('auth-tab--activo', tab.dataset.tab === pestana);
        });
        var formLogin = document.getElementById('auth-form-login');
        var formRegistro = document.getElementById('auth-form-registro');
        formLogin.classList.toggle('auth-form--activo', pestana === 'login');
        formRegistro.classList.toggle('auth-form--activo', pestana === 'registro');
        limpiarAlertas();
    }

    // ── Validación en tiempo real ───────────────────────────────────────────

    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function mostrarError(campoId, mensaje) {
        var input = document.getElementById(campoId);
        var errorEl = document.getElementById(campoId + '-error');
        if (input) input.classList.toggle('auth-input--error', !!mensaje);
        if (errorEl) errorEl.textContent = mensaje || '';
    }

    function limpiarError(campoId) {
        mostrarError(campoId, '');
    }

    function validarEmail(valor) {
        if (!valor.trim()) return 'El correo electrónico es obligatorio.';
        if (!emailRegex.test(valor)) return 'Ingresa un correo electrónico válido.';
        return '';
    }

    function validarPassword(valor) {
        if (!valor) return 'La contraseña es obligatoria.';
        if (valor.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
        return '';
    }

    function validarNombre(valor) {
        if (!valor.trim()) return 'El nombre es obligatorio.';
        if (valor.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres.';
        return '';
    }

    function configurarValidacionTiempoReal() {
        // Login
        var loginEmail = document.getElementById('login-email');
        var loginPass = document.getElementById('login-password');
        if (loginEmail) loginEmail.addEventListener('input', function () {
            if (loginEmail.value) limpiarError('login-email');
        });
        if (loginPass) loginPass.addEventListener('input', function () {
            if (loginPass.value) limpiarError('login-password');
        });

        // Registro
        var regNombre = document.getElementById('registro-nombre');
        var regEmail = document.getElementById('registro-email');
        var regPass = document.getElementById('registro-password');
        var regPass2 = document.getElementById('registro-password2');

        if (regNombre) regNombre.addEventListener('input', function () {
            if (regNombre.value) limpiarError('registro-nombre');
        });
        if (regEmail) regEmail.addEventListener('input', function () {
            if (regEmail.value) limpiarError('registro-email');
        });
        if (regPass) regPass.addEventListener('input', function () {
            if (regPass.value) limpiarError('registro-password');
            // Validar coincidencia en tiempo real
            if (regPass2.value) {
                if (regPass.value !== regPass2.value) {
                    mostrarError('registro-password2', 'Las contraseñas no coinciden.');
                } else {
                    limpiarError('registro-password2');
                }
            }
        });
        if (regPass2) regPass2.addEventListener('input', function () {
            if (regPass2.value) {
                if (regPass.value !== regPass2.value) {
                    mostrarError('registro-password2', 'Las contraseñas no coinciden.');
                } else {
                    limpiarError('registro-password2');
                }
            } else {
                limpiarError('registro-password2');
            }
        });
    }

    // ── Alertas ─────────────────────────────────────────────────────────────

    function mostrarAlerta(mensaje, tipo) {
        var contenedor = document.getElementById('auth-alertas');
        if (!contenedor) return;
        contenedor.innerHTML = '<div class="auth-alerta auth-alerta--' + tipo + '">' +
            '<i class="ri-' + (tipo === 'exito' ? 'checkbox-circle' : 'error-warning') + '-line"></i>' +
            '<span>' + mensaje + '</span>' +
            '</div>';
    }

    function limpiarAlertas() {
        var contenedor = document.getElementById('auth-alertas');
        if (contenedor) contenedor.innerHTML = '';
    }

    function limpiarFormularios() {
        var formularios = modal.querySelectorAll('.auth-form');
        formularios.forEach(function (f) { f.reset(); });
        var inputs = modal.querySelectorAll('.auth-input--error');
        inputs.forEach(function (i) { i.classList.remove('auth-input--error'); });
        var errores = modal.querySelectorAll('.auth-error');
        errores.forEach(function (e) { e.textContent = ''; });
    }

    // ── Manejo de envío de formularios ──────────────────────────────────────

    async function manejarLogin(e) {
        e.preventDefault();
        limpiarAlertas();

        var email = document.getElementById('login-email').value;
        var password = document.getElementById('login-password').value;

        // Validar
        var errorEmail = validarEmail(email);
        var errorPass = password ? '' : 'La contraseña es obligatoria.';
        mostrarError('login-email', errorEmail);
        mostrarError('login-password', errorPass);
        if (errorEmail || errorPass) return;

        // Cargando
        setBotonCargando('login-submit', true);

        var resultado = await AuthService.iniciarSesion(email, password);

        setBotonCargando('login-submit', false);

        if (resultado.ok) {
            mostrarAlerta('¡Bienvenido, ' + resultado.usuario.nombre + '!', 'exito');
            setTimeout(cerrar, 800);
        } else {
            mostrarAlerta(resultado.mensaje, 'error');
        }
    }

    async function manejarRegistro(e) {
        e.preventDefault();
        limpiarAlertas();

        var nombre = document.getElementById('registro-nombre').value;
        var email = document.getElementById('registro-email').value;
        var password = document.getElementById('registro-password').value;
        var password2 = document.getElementById('registro-password2').value;
        var terminos = document.getElementById('registro-terminos').checked;

        // Validar
        var errNombre = validarNombre(nombre);
        var errEmail = validarEmail(email);
        var errPass = validarPassword(password);
        var errPass2 = '';
        if (!password2) errPass2 = 'Confirma tu contraseña.';
        else if (password !== password2) errPass2 = 'Las contraseñas no coinciden.';

        mostrarError('registro-nombre', errNombre);
        mostrarError('registro-email', errEmail);
        mostrarError('registro-password', errPass);
        mostrarError('registro-password2', errPass2);

        if (!terminos) {
            mostrarAlerta('Debes aceptar los términos y condiciones para continuar.', 'error');
            return;
        }
        if (errNombre || errEmail || errPass || errPass2) return;

        // Cargando
        setBotonCargando('registro-submit', true);

        var resultado = await AuthService.registrar({
            nombre: nombre,
            email: email,
            password: password
        });

        setBotonCargando('registro-submit', false);

        if (resultado.ok) {
            mostrarAlerta(resultado.mensaje, 'exito');
            // Después de registrar, iniciar sesión automáticamente
            var login = await AuthService.iniciarSesion(email, password);
            if (login.ok) {
                setTimeout(cerrar, 1200);
            } else {
                // Si no se pudo loguear, cambiar a pestaña login
                setTimeout(function () {
                    cambiarPestana('login');
                    document.getElementById('login-email').value = email;
                }, 1500);
            }
        } else {
            mostrarAlerta(resultado.mensaje, 'error');
        }
    }

    function setBotonCargando(id, cargando) {
        var btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('auth-submit--cargando', cargando);
        btn.disabled = cargando;
    }

    // ── Toggle de visibilidad de contraseña ─────────────────────────────────

    function togglePassword(targetId, boton) {
        var input = document.getElementById(targetId);
        if (!input) return;
        var esPassword = input.type === 'password';
        input.type = esPassword ? 'text' : 'password';
        var icono = boton.querySelector('i');
        if (icono) {
            icono.className = esPassword ? 'ri-eye-off-line' : 'ri-eye-line';
        }
    }

    // ── Eventos ─────────────────────────────────────────────────────────────

    function configurarEventos() {
        if (modal.dataset.eventosConfigurados) return;
        modal.dataset.eventosConfigurados = 'true';

        // Cerrar
        document.getElementById('auth-cerrar').addEventListener('click', cerrar);
        modal.addEventListener('click', function (e) {
            if (e.target === modal) cerrar();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && esVisible) cerrar();
        });

        // Pestañas
        modal.querySelectorAll('.auth-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                cambiarPestana(tab.dataset.tab);
            });
        });

        // Toggle contraseñas
        modal.querySelectorAll('.auth-toggle-password').forEach(function (btn) {
            btn.addEventListener('click', function () {
                togglePassword(btn.dataset.target, btn);
            });
        });

        // Envío de formularios
        document.getElementById('auth-form-login').addEventListener('submit', manejarLogin);
        document.getElementById('auth-form-registro').addEventListener('submit', manejarRegistro);

        // Link "olvidaste" → cambia a registro (simulado, ya que no hay backend)
        var olvidaste = document.getElementById('auth-olvidaste');
        if (olvidaste) {
            olvidaste.addEventListener('click', function (e) {
                e.preventDefault();
                mostrarAlerta('Por favor crea una nueva cuenta o contacta al soporte.', 'info');
            });
        }

        configurarValidacionTiempoReal();
    }

    // ── Inicialización ──────────────────────────────────────────────────────

    function iniciar() {
        inyectarModal();
        configurarEventos();

        // Botones que abren el modal (cualquier elemento con data-auth-open)
        document.querySelectorAll('[data-auth-open]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                abrir(el.dataset.authOpen);
            });
        });
    }

    // API pública
    return {
        iniciar: iniciar,
        abrir: abrir,
        cerrar: cerrar
    };

})();
