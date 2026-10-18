// js/services/supabaseClient.js
// ============================================================================
// CLIENTE SUPABASE — Prana Fitness
// ============================================================================
// Configuración del cliente público de Supabase para conectar con PostgreSQL
// CDN oficial: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
//
// NOTA: Este proyecto funciona 100% con Supabase. No hay fallback a localStorage.
// ============================================================================

(function () {
    'use strict';

    // Configuración del proyecto Supabase
    var SUPABASE_URL = 'https://yqcnovplbqyfcizwpoyz.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_Exf464Hd5MP_SqqRWNkwCg_jGpmY3wb';

    // Cargar el cliente Supabase desde CDN
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.onload = function () {
        if (window.supabase) {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('[Supabase] Cliente inicializado correctamente');
            // Disparar evento personalizado para notificar que el cliente está listo
            window.dispatchEvent(new CustomEvent('supabase:ready'));
        } else {
            console.error('[Supabase] Error: La librería no se cargó correctamente desde CDN');
            alert('Error crítico: No se pudo conectar con Supabase. Por favor, verifica tu conexión a internet.');
        }
    };
    script.onerror = function () {
        console.error('[Supabase] Error de red al cargar la librería Supabase');
        alert('Error de conexión: No se pudo conectar con Supabase. Verifica tu conexión a internet.');
    };
    document.head.appendChild(script);

    // Helper para garantizar la espera activa hasta que el cliente esté disponible
    window.obtenerClienteSupabase = async function () {
        if (window.supabaseClient) return window.supabaseClient;
        return new Promise(function (resolve) {
            var check = setInterval(function () {
                if (window.supabaseClient) {
                    clearInterval(check);
                    resolve(window.supabaseClient);
                }
            }, 50);
        });
    };

    // Exponer una función helper para manejar errores de Supabase
    window.SupabaseHelper = {
        manejarError: function (error, contexto) {
            console.error('[Supabase] Error en ' + contexto + ':', error);
            var mensaje = 'Error en ' + contexto + ': ' + (error.message || 'Error desconocido');
            console.error(mensaje);
            return mensaje;
        }
    };

})();
