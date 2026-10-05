// js/main.js
// Punto de entrada del sitio. Se carga en todas las páginas.
// Solo inicializa los componentes compartidos.
// La lógica exclusiva de cada página vive en js/pages/[pagina].js

document.addEventListener('DOMContentLoaded', function() {
    console.log('¡Sitio Marca Fitness cargado correctamente!');

    iniciarMenu();     // js/components/menu.js
    iniciarCarrito();  // js/components/carrito.js
});
