// js/pages/productos.js
// Responsabilidad: lógica exclusiva de productos.html (catálogo).
// — Conecta los botones "Agregar al Carrito" con CarritoService
// — Muestra feedback visual al agregar
// — Sincroniza el badge del header
//
// Dependencias: utils/storage.js, components/carrito.js

(function () {

    'use strict';

    // Catálogo de productos: fuente de verdad para los datos que se persisten
    // en el carrito. Cada id debe ser único y estable entre páginas.
    var CATALOGO = [
        {
            id:        'whey-protein-2kg',
            nombre:    'Whey Protein Premium 2kg',
            precio:    189000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239384/1111111.png',
            categoria: 'Suplementos'
        },
        {
            id:        'creatina-500g',
            nombre:    'Creatina Monohidratada 500g',
            precio:    95000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791237388/22.png',
            categoria: 'Suplementos'
        },
        {
            id:        'barras-proteicas-x12',
            nombre:    'Barras Proteicas Pack x12',
            precio:    82000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239559/222222-removebg-preview.png',
            categoria: 'Suplementos'
        },
        {
            id:        'leggings-hw',
            nombre:    'Leggings Compresión High-Waist',
            precio:    115000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239646/sdd.png',
            categoria: 'Indumentaria'
        },
        {
            id:        'sports-bra',
            nombre:    'Sports Bra Soporte Alto',
            precio:    89000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239713/rrrr.png',
            categoria: 'Indumentaria'
        },
        {
            id:        'sneakers-training-pro',
            nombre:    'Sneakers Training Pro',
            precio:    260000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791237492/33.png',
            categoria: 'Indumentaria'
        },
        {
            id:        'mancuernas-20kg',
            nombre:    'Mancuernas Ajustables 20kg (par)',
            precio:    489000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239824/ee-removebg-preview.png',
            categoria: 'Equipamiento'
        },
        {
            id:        'bandas-elasticas-x5',
            nombre:    'Bandas Elásticas Set x5 Niveles',
            precio:    45000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239903/eqw.png',
            categoria: 'Accesorios'
        },
        {
            id:        'shaker-pro-700ml',
            nombre:    'Shaker Mezclador Pro 700ml',
            precio:    32000,
            imagen:    'https://res.cloudinary.com/atexcbli/image/upload/v1791239962/fre.png',
            categoria: 'Accesorios'
        }
    ];

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Busca el producto en el catálogo por el data-producto-id del botón.
     * Como alternativa, acepta data-producto-index (posición en el array).
     */
    function resolverProducto(boton) {
        var pid   = boton.getAttribute('data-producto-id');
        var pidx  = boton.getAttribute('data-producto-index');

        if (pid) {
            return CATALOGO.find(function (p) { return p.id === pid; }) || null;
        }
        if (pidx !== null) {
            return CATALOGO[parseInt(pidx, 10)] || null;
        }
        return null;
    }

    /**
     * Feedback visual en el botón tras agregar al carrito.
     */
    function animarBoton(boton) {
        var textoOriginal = boton.innerHTML;
        var clasesOriginales = boton.className;

        boton.disabled   = true;
        boton.innerHTML  = '<i class="ri-checkbox-circle-fill me-2"></i>¡Agregado!';
        boton.classList.add('btn-carrito--agregado');

        setTimeout(function () {
            boton.disabled   = false;
            boton.innerHTML  = textoOriginal;
            boton.className  = clasesOriginales;
        }, 1800);
    }

    // ── Inicialización ───────────────────────────────────────────────────────

    function init() {
        if (typeof CarritoService === 'undefined') return;

        // Sincronizar el badge al cargar
        CarritoService.iniciar();

        // Conectar todos los botones "Agregar al carrito"
        var botones = document.querySelectorAll('[data-accion="agregar-carrito"]');

        botones.forEach(function (boton) {
            boton.addEventListener('click', function (e) {
                e.preventDefault();

                var producto = resolverProducto(boton);
                if (!producto) {
                    console.warn('[Prana] Producto no encontrado para el botón:', boton);
                    return;
                }

                CarritoService.agregar(producto);
                animarBoton(boton);

                // Actualizar badge visualmente con micro-animación
                var badges = document.querySelectorAll('.contador-carrito');
                badges.forEach(function (b) {
                    b.classList.remove('carrito-badge--pulso');
                    // Forzar reflow para reiniciar la animación
                    void b.offsetWidth;
                    b.classList.add('carrito-badge--pulso');
                });
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
