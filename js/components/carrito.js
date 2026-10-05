// js/components/carrito.js
// Responsabilidad: sincronizar el contador del carrito en el header.
// Compartido en todas las páginas. Depende de: utils/storage.js
// La lógica de los botones "Agregar al carrito" vive en pages/index.js
// porque actualmente solo existen en index.html.

function iniciarCarrito() {
    var contadorCarrito = document.querySelector('.contador-carrito');

    // Si esta página no tiene contador visible en el header, no hace nada
    if (!contadorCarrito) return;

    // Sincronizar el contador con el valor persistido
    contadorCarrito.textContent = Storage.obtener('carrito', 0);
}
