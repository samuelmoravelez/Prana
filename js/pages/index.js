// js/pages/index.js
// Responsabilidad: lógica exclusiva de index.html (página de inicio).
// Depende de: utils/storage.js

function iniciarBotonesCarrito() {
    var botonesComprar  = document.querySelectorAll('.btn-comprar-tarjeta');
    var contadorCarrito = document.querySelector('.contador-carrito');

    // Si no hay botones de compra en esta página, no hace nada
    if (botonesComprar.length === 0) return;

    botonesComprar.forEach(function(boton) {
        boton.addEventListener('click', function() {
            // Incrementar y persistir la cantidad
            var cantidad = Storage.obtener('carrito', 0) + 1;
            Storage.guardar('carrito', cantidad);

            // Actualizar el contador visible en el header
            if (contadorCarrito) {
                contadorCarrito.textContent = cantidad;
            }

            // Feedback visual en el botón
            boton.textContent            = '¡Agregado! ✓';
            boton.style.backgroundColor  = 'var(--azul-principal)';
            boton.style.color            = 'white';

            setTimeout(function() {
                boton.textContent           = 'Agregar al Carrito';
                boton.style.backgroundColor = 'transparent';
                boton.style.color           = 'var(--texto-oscuro)';
            }, 1500);
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    iniciarBotonesCarrito();
});
