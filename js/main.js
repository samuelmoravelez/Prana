// js/main.js
// Punto de entrada del sitio. Se carga en todas las páginas.
// Solo inicializa los componentes compartidos.
// La lógica exclusiva de cada página vive en js/pages/[pagina].js

document.addEventListener('DOMContentLoaded', function() {
    console.log('¡Sitio Prana Fitness cargado correctamente!');

    iniciarMenu();     // js/components/menu.js

    // Carrito: usar CarritoService si está disponible (nueva versión),
    // o la función legada iniciarCarrito() como fallback
    if (typeof CarritoService !== 'undefined') {
        CarritoService.iniciar();  // js/components/carrito.js (nueva API)
    } else if (typeof iniciarCarrito === 'function') {
        iniciarCarrito();          // fallback versión legada
    }

    // Módulo de autenticación (solo si está disponible)
    if (typeof AuthModal !== 'undefined') {
        AuthModal.iniciar();   // js/components/auth-modal.js
    }
    if (typeof AuthGuard !== 'undefined') {
        AuthGuard.iniciar();   // js/components/auth-guard.js
    }
});
