// js/components/carrito.js
// Responsabilidad: lógica compartida del carrito (todas las páginas).
// — Gestión del array de items en localStorage (clave: 'prana_carrito')
// — Sincronización del badge/contador en el header
// — API pública: CarritoService
//
// NOTA: El carrito es estado temporal de sesión y se mantiene en localStorage por diseño.
// Los pedidos finales se guardan en Supabase cuando el usuario completa la compra.
//
// Estructura de cada ítem en localStorage:
// {
//   id:       string   — identificador único del producto
//   nombre:   string
//   precio:   number   — precio unitario en pesos COP
//   imagen:   string   — URL de la imagen
//   categoria:string
//   cantidad: number   — ≥ 1
// }
//
// Dependencias: utils/storage.js (cargado antes)

var CarritoService = (function () {

    'use strict';

    var KEY = 'prana_carrito';
    var ENVIO_GRATIS_DESDE = 150000; // COP
    var COSTO_ENVIO        = 15000;  // COP si no alcanza el umbral

    // ── Helpers internos ────────────────────────────────────────────────────

    function leerItems() {
        var raw = Storage.obtener(KEY, null);
        if (!raw) return [];
        try {
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function guardarItems(items) {
        Storage.guardar(KEY, JSON.stringify(items));
        _actualizarContadores();
        _dispatchCambio();
    }

    // Actualiza TODOS los badges .contador-carrito presentes en el DOM
    function _actualizarContadores() {
        var total = obtenerCantidadTotal();
        var badges = document.querySelectorAll('.contador-carrito');
        badges.forEach(function (b) {
            b.textContent = total;
            // Ocultar el badge si el carrito está vacío
            b.style.display = total > 0 ? '' : 'none';
        });
    }

    function _dispatchCambio() {
        // Evento personalizado para que carrito.html pueda reaccionar
        try {
            var ev = new CustomEvent('prana:carritoActualizado');
            document.dispatchEvent(ev);
        } catch (e) { /* ignora en navegadores muy viejos */ }
    }

    // ── API PÚBLICA ─────────────────────────────────────────────────────────

    /**
     * Devuelve todos los ítems del carrito.
     * @returns {Array}
     */
    function obtenerItems() {
        return leerItems();
    }

    /**
     * Agrega un producto al carrito.
     * Si el producto ya existe, incrementa su cantidad en 1.
     *
     * @param {Object} producto - { id, nombre, precio, imagen, categoria }
     * @returns {number} nueva cantidad del ítem agregado
     */
    function agregar(producto) {
        if (!producto || !producto.id) return 0;

        var items = leerItems();
        var prodId = String(producto.id);
        var idx   = items.findIndex(function (i) { return String(i.id) === prodId; });

        if (idx >= 0) {
            items[idx].cantidad += 1;
        } else {
            items.push({
                id:       prodId,
                nombre:   String(producto.nombre   || 'Producto'),
                precio:   Number(producto.precio   || 0),
                imagen:   String(producto.imagen   || ''),
                categoria:String(producto.categoria || ''),
                cantidad: 1
            });
        }

        guardarItems(items);
        return idx >= 0 ? items[idx].cantidad : 1;
    }

    /**
     * Cambia la cantidad de un ítem. Si llega a 0 o menos, lo elimina.
     *
     * @param {string} id
     * @param {number} nuevaCantidad
     */
    function setCantidad(id, nuevaCantidad) {
        var strId = String(id);
        var items = leerItems();
        if (nuevaCantidad <= 0) {
            items = items.filter(function (i) { return String(i.id) !== strId; });
        } else {
            var idx = items.findIndex(function (i) { return String(i.id) === strId; });
            if (idx >= 0) items[idx].cantidad = Math.min(nuevaCantidad, 99);
        }
        guardarItems(items);
    }

    /**
     * Elimina un ítem por id.
     * @param {string} id
     */
    function eliminar(id) {
        var strId = String(id);
        var items = leerItems().filter(function (i) { return String(i.id) !== strId; });
        guardarItems(items);
    }

    /**
     * Vacía el carrito completamente.
     */
    function vaciar() {
        Storage.eliminar(KEY);
        _actualizarContadores();
        _dispatchCambio();
    }

    /**
     * Cantidad total de unidades en el carrito (suma de todas las cantidades).
     * @returns {number}
     */
    function obtenerCantidadTotal() {
        return leerItems().reduce(function (acc, i) { return acc + i.cantidad; }, 0);
    }

    /**
     * Subtotal antes de envío.
     * @returns {number}
     */
    function obtenerSubtotal() {
        return leerItems().reduce(function (acc, i) {
            return acc + (i.precio * i.cantidad);
        }, 0);
    }

    /**
     * Costo de envío (0 si supera el umbral de envío gratis).
     * @returns {number}
     */
    function obtenerCostoEnvio() {
        return obtenerSubtotal() >= ENVIO_GRATIS_DESDE ? 0 : COSTO_ENVIO;
    }

    /**
     * Total final a pagar (subtotal + envío).
     * @returns {number}
     */
    function obtenerTotal() {
        return obtenerSubtotal() + obtenerCostoEnvio();
    }

    /**
     * Inicia el contador al cargar cualquier página.
     * Llamar desde main.js o el script de cada página.
     */
    function iniciar() {
        _actualizarContadores();
    }

    return {
        obtenerItems:       obtenerItems,
        agregar:            agregar,
        setCantidad:        setCantidad,
        eliminar:           eliminar,
        vaciar:             vaciar,
        obtenerCantidadTotal: obtenerCantidadTotal,
        obtenerSubtotal:    obtenerSubtotal,
        obtenerCostoEnvio:  obtenerCostoEnvio,
        obtenerTotal:       obtenerTotal,
        iniciar:            iniciar,
        ENVIO_GRATIS_DESDE: ENVIO_GRATIS_DESDE,
        COSTO_ENVIO:        COSTO_ENVIO
    };

})();
