// js/services/productos-store.js
// ============================================================================
// SERVICIO CENTRALIZADO DE PRODUCTOS — Prana Fitness
// ============================================================================
// Gestiona el catálogo de productos 100% en Supabase (PostgreSQL)
// Provee persistencia CRUD en tiempo real para:
//   - Catálogo de tienda (paginas/productos.html)
//   - Panel de administración (dashboard.html -> Gestión de Productos)
//   - Carrito de compras (carrito.html)
//
// NOTA: Este servicio funciona exclusivamente con Supabase. No hay fallback a localStorage.
// ============================================================================

var ProductosStore = (function () {

    'use strict';

    // ── Catálogo semilla por defecto (para migración inicial a Supabase) ──────

    // ── Catálogo semilla por defecto ─────────────────────────────────────────
    var PRODUCTOS_SEMILLA = [
        {
            id:          'whey-protein-2kg',
            nombre:      'Whey Protein Premium 2kg',
            precio:      189000,
            categoria:   'Suplementos',
            descripcion: '25g de proteína por porción. Bajo en grasa, ideal para volumen muscular y recuperación acelerada.',
            stock:       24,
            imagen:      'https://res.cloudinary.com/atexcbli/image/upload/v1791239384/1111111.png',
            badge:       'Nuevo'
        },
        {
            id:          'creatina-500g',
            nombre:      'Creatina Monohidratada 500g',
            precio:      95000,
            categoria:   'Suplementos',
            descripcion: 'Creatina micronizada pura. Aumenta fuerza máxima, potencia explosiva y recuperación celular.',
            stock:       35,
            imagen:      'https://res.cloudinary.com/atexcbli/image/upload/v1791237388/22.png',
            badge:       'Popular'
        },
        {
            id:          'barras-proteicas-x12',
            nombre:      'Barras Proteicas Pack x12',
            precio:      82000,
            categoria:   'Suplementos',
            descripcion: '20g de proteína por barra. Snack nutritivo ideal pre/post entrenamiento y entre comidas.',
            stock:       40,
            imagen:      'https://res.cloudinary.com/atexcbli/image/upload/v1791239559/222222-removebg-preview.png',
            badge:       'Destacado'
        },
        {
            id:          'leggings-hw',
            nombre:      'Leggings Compresión High-Waist',
            precio:      115000,
            categoria:   'Indumentaria',
            descripcion: 'Tejido técnico con control de abdomen y efecto lifting. Costuras reforzadas anti-rozaduras.',
            stock:       18,
            imagen:      'https://res.cloudinary.com/atexcbli/image/upload/v1791239646/sdd.png',
            badge:       ''
        },
        {
            id:          'sports-bra',
            nombre:      'Sports Bra Soporte Alto',
            precio:      89000,
            categoria:   'Indumentaria',
            descripcion: 'Máxima sujeción para entrenamientos de alto impacto. Tejido transpirable de secado ultra rápido.',
            stock:       22,
            imagen:      'https://res.cloudinary.com/atexcbli/image/upload/v1791239713/rrrr.png',
            badge:       ''
        },
        {
            id:          'sneakers-training-pro',
            nombre:      'Sneakers Training Pro',
            precio:      260000,
            categoria:   'Indumentaria',
            descripcion: 'Zapatillas de entrenamiento con suela plana anti-deslizante y soporte lateral para levantamiento.',
            stock:       15,
            imagen:      'https://res.cloudinary.com/atexcbli/image/upload/v1791237492/33.png',
            badge:       'Destacado'
        },
        {
            id:          'mancuernas-20kg',
            nombre:      'Mancuernas Ajustables 20kg (par)',
            precio:      489000,
            categoria:   'Equipamiento',
            descripcion: 'Sistema de dial rápido de 2kg a 20kg por mancuerna. Optimiza espacio en tu home-gym.',
            stock:       8,
            imagen:      'https://res.cloudinary.com/atexcbli/image/upload/v1791239824/ee-removebg-preview.png',
            badge:       'Oferta'
        },
        {
            id:          'bandas-elasticas-x5',
            nombre:      'Bandas Elásticas Set x5 Niveles',
            precio:      45000,
            categoria:   'Accesorios',
            descripcion: '5 resistencias de látex 100% natural (10 a 50 lbs) con bolsa de transporte e instrucciones.',
            stock:       50,
            imagen:      'https://res.cloudinary.com/atexcbli/image/upload/v1791239903/eqw.png',
            badge:       ''
        },
        {
            id:          'shaker-pro-700ml',
            nombre:      'Shaker Mezclador Pro 700ml',
            precio:      32000,
            categoria:   'Accesorios',
            descripcion: 'Libre de BPA con batidor de acero inoxidable. Cierre hermético a prueba de fugas y derrames.',
            stock:       60,
            imagen:      'https://res.cloudinary.com/atexcbli/image/upload/v1791239962/fre.png',
            badge:       ''
        }
    ];

    var _cacheProductos = [];

    // ── API Pública (exclusivamente Supabase) ──────────────────────────────────

    /**
     * Obtiene todos los productos desde Supabase.
     * @returns {Promise<Array>} Lista de productos
     */
    async function obtenerTodos() {
        if (!window.supabaseClient) {
            console.warn('[ProductosStore] Supabase client no está inicializado');
            return _cacheProductos;
        }

        try {
            var { data, error } = await window.supabaseClient
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[ProductosStore] Error al obtener productos:', error);
                return _cacheProductos;
            }

            if (!data || data.length === 0) {
                _cacheProductos = [];
                return [];
            }

            // Transformar datos de Supabase garantizando columnas exactas y compatibilidad
            var mapeados = data.map(function (p) {
                return {
                    id:            p.id,
                    name:          p.name,
                    nombre:        p.name,
                    price:         Number(p.price) || 0,
                    precio:        Number(p.price) || 0,
                    category:      p.category,
                    categoria:     p.category,
                    description:   p.description || '',
                    descripcion:   p.description || '',
                    stock:         p.stock || 0,
                    image_url:     p.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png',
                    imagen:        p.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png',
                    badge:         p.badge || null,
                    created_at:    p.created_at,
                    creadoEn:      p.created_at,
                    updated_at:    p.updated_at,
                    actualizadoEn: p.updated_at
                };
            });

            _cacheProductos = mapeados;
            return mapeados;
        } catch (e) {
            console.error('[ProductosStore] Error al obtener productos:', e);
            return _cacheProductos;
        }
    }

    /**
     * Obtiene los productos en caché de forma síncrona.
     * @returns {Array}
     */
    function obtenerTodosSync() {
        return Array.isArray(_cacheProductos) ? _cacheProductos : [];
    }

    /**
     * Busca un producto por su ID único.
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async function obtenerPorId(id) {
        if (!id) return null;

        if (_cacheProductos && _cacheProductos.length > 0) {
            var match = _cacheProductos.find(function (p) { return String(p.id) === String(id); });
            if (match) return match;
        }

        if (!window.supabaseClient) {
            return null;
        }

        try {
            var { data, error } = await window.supabaseClient
                .from('products')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !data) {
                return null;
            }

            return {
                id:            data.id,
                name:          data.name,
                nombre:        data.name,
                price:         Number(data.price) || 0,
                precio:        Number(data.price) || 0,
                category:      data.category,
                categoria:     data.category,
                description:   data.description || '',
                descripcion:   data.description || '',
                stock:         data.stock || 0,
                image_url:     data.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png',
                imagen:        data.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png',
                badge:         data.badge || null,
                created_at:    data.created_at,
                creadoEn:      data.created_at,
                updated_at:    data.updated_at,
                actualizadoEn: data.updated_at
            };
        } catch (e) {
            console.error('[ProductosStore] Error al buscar producto por ID:', e);
            return null;
        }
    }

    /**
     * Crea o actualiza un producto en el catálogo.
     * Si datos.id existe, se actualiza; si no, se genera uno nuevo.
     * @param {Object} datos
     * @returns {Promise<Object>} Producto guardado
     */
    async function guardar(datos) {
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        var id = datos.id ? String(datos.id).trim() : '';

        var productoNormalizado = {
            name:        String(datos.nombre || '').trim(),
            price:       Math.max(0, parseInt(datos.precio, 10) || 0),
            category:    String(datos.categoria || 'Suplementos').trim(),
            description: String(datos.descripcion || '').trim(),
            stock:       Math.max(0, parseInt(datos.stock, 10) || 0),
            image_url:   String(datos.imagen || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png').trim(),
            badge:       String(datos.badge || '').trim()
        };

        try {
            var result;
            if (id) {
                // Actualización
                var { data, error } = await window.supabaseClient
                    .from('products')
                    .update(productoNormalizado)
                    .eq('id', id)
                    .select()
                    .single();

                if (error) {
                    throw new Error('Error al actualizar producto: ' + error.message);
                }

                result = {
                    id: data.id,
                    nombre: data.name,
                    precio: Number(data.price),
                    categoria: data.category,
                    descripcion: data.description || '',
                    stock: data.stock || 0,
                    imagen: data.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png',
                    badge: data.badge || '',
                    actualizadoEn: data.updated_at
                };
            } else {
                // Inserción
                var { data, error } = await window.supabaseClient
                    .from('products')
                    .insert(productoNormalizado)
                    .select()
                    .single();

                if (error) {
                    throw new Error('Error al crear producto: ' + error.message);
                }

                result = {
                    id: data.id,
                    nombre: data.name,
                    precio: Number(data.price),
                    categoria: data.category,
                    descripcion: data.description || '',
                    stock: data.stock || 0,
                    imagen: data.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png',
                    badge: data.badge || '',
                    creadoEn: data.created_at,
                    actualizadoEn: data.updated_at
                };
            }

            // Disparar evento para que otras pestañas o componentes reaccionen
            window.dispatchEvent(new CustomEvent('prana:productos_actualizados', {
                detail: { total: 1 }
            }));

            return result;
        } catch (e) {
            console.error('[ProductosStore] Error al guardar producto:', e);
            throw e;
        }
    }

    /**
     * Elimina un producto por ID.
     * @param {string} id
     * @returns {Promise<boolean>} true si se eliminó
     */
    async function eliminar(id) {
        if (!id) throw new Error('ID de producto requerido');
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        try {
            var { error } = await window.supabaseClient
                .from('products')
                .delete()
                .eq('id', id);

            if (error) {
                throw new Error('Error al eliminar producto: ' + error.message);
            }

            // Disparar evento para que otras pestañas o componentes reaccionen
            window.dispatchEvent(new CustomEvent('prana:productos_actualizados', {
                detail: { total: 0 }
            }));

            return true;
        } catch (e) {
            console.error('[ProductosStore] Error al eliminar producto:', e);
            throw e;
        }
    }

    /**
     * Descuenta stock de productos tras una compra completada.
     * @param {Array} items - [{ id, cantidad }]
     * @returns {Promise<void>}
     */
    async function descontarStock(items) {
        if (!Array.isArray(items) || items.length === 0) return;
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        try {
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                var { data: prod, error } = await window.supabaseClient
                    .from('products')
                    .select('stock')
                    .eq('id', it.id)
                    .single();

                if (error) {
                    console.error('[ProductosStore] Error al obtener stock del producto:', error);
                    continue;
                }

                if (prod) {
                    var nuevoStock = Math.max(0, (prod.stock || 0) - (it.cantidad || 1));
                    var { error: updateError } = await window.supabaseClient
                        .from('products')
                        .update({ stock: nuevoStock })
                        .eq('id', it.id);

                    if (updateError) {
                        console.error('[ProductosStore] Error al actualizar stock:', updateError);
                    }
                }
            }
        } catch (e) {
            console.error('[ProductosStore] Error al descontar stock:', e);
            throw e;
        }
    }

    /**
     * Restablece los productos al catálogo original semilla.
     * Solo para desarrollo - elimina todos los productos y vuelve a insertar la semilla.
     * @returns {Promise<Array>}
     */
    async function restablecerSemilla() {
        if (!window.supabaseClient) {
            throw new Error('Supabase client no está inicializado');
        }

        try {
            console.warn('[ProductosStore] Restableciendo productos a versión semilla. Esto eliminará todos los productos existentes.');

            // Eliminar todos los productos
            var { error: deleteError } = await window.supabaseClient
                .from('products')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Condición para eliminar todos

            if (deleteError) {
                throw new Error('Error al eliminar productos: ' + deleteError.message);
            }

            // Insertar productos semilla
            var productosSemilla = PRODUCTOS_SEMILLA.map(function (p) {
                return {
                    name: p.nombre,
                    price: p.precio,
                    category: p.categoria,
                    description: p.descripcion,
                    stock: p.stock,
                    image_url: p.imagen,
                    badge: p.badge
                };
            });

            var { data, error: insertError } = await window.supabaseClient
                .from('products')
                .insert(productosSemilla)
                .select();

            if (insertError) {
                throw new Error('Error al insertar productos semilla: ' + insertError.message);
            }

            console.log('[ProductosStore] Productos restablecidos exitosamente. Total:', data.length);

            // Disparar evento para actualizar UI
            window.dispatchEvent(new CustomEvent('prana:productos_actualizados', {
                detail: { total: data.length }
            }));

            return data.map(function (p) {
                return {
                    id: p.id,
                    nombre: p.name,
                    precio: Number(p.price),
                    categoria: p.category,
                    descripcion: p.description || '',
                    stock: p.stock || 0,
                    imagen: p.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png',
                    badge: p.badge || '',
                    creadoEn: p.created_at,
                    actualizadoEn: p.updated_at
                };
            });
        } catch (e) {
            console.error('[ProductosStore] Error al restablecer semilla:', e);
            throw e;
        }
    }

    return {
        obtenerTodos:       obtenerTodos,
        obtenerTodosSync:   obtenerTodosSync,
        obtenerPorId:       obtenerPorId,
        guardar:            guardar,
        eliminar:           eliminar,
        descontarStock:     descontarStock,
        restablecerSemilla: restablecerSemilla
    };

})();
