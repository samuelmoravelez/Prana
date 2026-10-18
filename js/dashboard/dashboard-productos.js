/**
 * js/dashboard/dashboard-productos.js
 * Lógica CRUD, filtrado y gestión de la tabla `products` en el dashboard de administración.
 */

import { obtenerClienteSupabase, esc, formatoCOP, vacio, DToast, DSidebar } from './dashboard-common.js';

var _productosDashboardCache = [];
var _sincronizandoProductosDashboard = false;
var _prodBusqueda = '';
var _prodCategoria = '';

/**
 * Obtiene la lista de productos (sincroniza en background con Supabase si está disponible).
 * @returns {Array} Lista de productos
 */
export function getProductos() {
    if (typeof ProductosStore !== 'undefined' && ProductosStore.obtenerTodosSync) {
        var sync = ProductosStore.obtenerTodosSync();
        if (Array.isArray(sync) && sync.length > 0) return sync;
    }

    if (typeof window !== 'undefined' && window.supabaseClient && !_sincronizandoProductosDashboard) {
        _sincronizandoProductosDashboard = true;
        window.supabaseClient
            .from('products')
            .select('*')
            .order('created_at', { ascending: false })
            .then(function (res) {
                _sincronizandoProductosDashboard = false;
                if (res && !res.error && Array.isArray(res.data)) {
                    _productosDashboardCache = res.data.map(function (p) {
                        return {
                            id:          p.id,
                            nombre:      p.name,
                            name:        p.name,
                            precio:      Number(p.price) || 0,
                            price:       Number(p.price) || 0,
                            categoria:   p.category,
                            category:    p.category,
                            descripcion: p.description || '',
                            description: p.description || '',
                            stock:       p.stock || 0,
                            imagen:      p.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png',
                            image_url:   p.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png',
                            badge:       p.badge || ''
                        };
                    });
                }
            })
            .catch(function () { _sincronizandoProductosDashboard = false; });
    }

    return Array.isArray(_productosDashboardCache) ? _productosDashboardCache : [];
}

/**
 * Guarda o actualiza un producto en Supabase / ProductosStore.
 * @param {Object} datos 
 * @returns {Promise<Object>|Object}
 */
export async function guardarProducto(datos) {
    if (typeof ProductosStore !== 'undefined' && ProductosStore.guardar) {
        return await ProductosStore.guardar(datos);
    }

    var supabase = await obtenerClienteSupabase();
    if (!supabase) return null;

    var payload = {
        name: datos.nombre || datos.name,
        category: datos.categoria || datos.category,
        price: Number(datos.precio !== undefined ? datos.precio : datos.price) || 0,
        stock: parseInt(datos.stock, 10) || 0,
        badge: (datos.badge || '').trim(),
        image_url: datos.imagen || datos.image_url,
        description: datos.descripcion || datos.description || ''
    };

    var res;
    if (datos.id) {
        res = await supabase.from('products').update(payload).eq('id', datos.id).select();
    } else {
        res = await supabase.from('products').insert(payload).select();
    }

    if (res && !res.error && Array.isArray(res.data) && res.data[0]) {
        var prodGuardado = res.data[0];
        var item = {
            id: prodGuardado.id,
            nombre: prodGuardado.name,
            name: prodGuardado.name,
            precio: Number(prodGuardado.price) || 0,
            price: Number(prodGuardado.price) || 0,
            categoria: prodGuardado.category,
            category: prodGuardado.category,
            stock: prodGuardado.stock || 0,
            badge: prodGuardado.badge || '',
            imagen: prodGuardado.image_url,
            image_url: prodGuardado.image_url,
            descripcion: prodGuardado.description || ''
        };
        var idx = _productosDashboardCache.findIndex(function(x) { return x.id === item.id; });
        if (idx >= 0) {
            _productosDashboardCache[idx] = item;
        } else {
            _productosDashboardCache.unshift(item);
        }
        return item;
    }
    return null;
}

/**
 * Elimina un producto por ID.
 * @param {string} id 
 * @returns {Promise<boolean>|boolean}
 */
export async function eliminarProducto(id) {
    if (typeof ProductosStore !== 'undefined' && ProductosStore.eliminar) {
        return await ProductosStore.eliminar(id);
    }

    var supabase = await obtenerClienteSupabase();
    if (!supabase) return false;

    var res = await supabase.from('products').delete().eq('id', id);
    if (!res.error) {
        _productosDashboardCache = _productosDashboardCache.filter(function(x) { return x.id !== id; });
        return true;
    }
    return false;
}

/**
 * Establece los filtros de búsqueda y categoría para la tabla de administración.
 * @param {string} busqueda 
 * @param {string} categoria 
 */
export function setFiltroProductos(busqueda, categoria) {
    _prodBusqueda = typeof busqueda === 'string' ? busqueda.trim() : _prodBusqueda;
    _prodCategoria = typeof categoria === 'string' ? categoria.trim() : _prodCategoria;
    renderProductosAdmin();
}

/**
 * Renderiza la tabla de productos de administración con filtros y badges.
 */
export function renderProductosAdmin() {
    var tbody = document.getElementById('admin-productos-tbody');
    var total = document.getElementById('admin-productos-total');
    if (!tbody) return;

    var prods = getProductos();

    // Aplicar filtros
    var filtrados = (Array.isArray(prods) ? prods.filter(function (p) {
        if (!p) return false;
        var q = _prodBusqueda.toLowerCase();
        var coincideTexto = !q ||
            (p.nombre && p.nombre.toLowerCase().indexOf(q) >= 0) ||
            (p.descripcion && p.descripcion.toLowerCase().indexOf(q) >= 0) ||
            (p.categoria && p.categoria.toLowerCase().indexOf(q) >= 0);
        var coincideCat = !_prodCategoria || p.categoria === _prodCategoria;
        return coincideTexto && coincideCat;
    }) : []);

    if (total) {
        total.textContent = prods.length + ' producto' + (prods.length !== 1 ? 's' : '');
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">' +
            vacio('ri-box-3-line', 'Sin productos', 'No se encontraron productos con los criterios seleccionados.') +
            '</td></tr>';
        return;
    }

    tbody.innerHTML = filtrados.map(function (p) {
        var stockNum = parseInt(p.stock, 10) || 0;
        var stockCls = stockNum === 0 ? 'd-status--cancelado' : stockNum <= 5 ? 'd-status--pendiente' : 'd-status--activo';
        var stockTxt = stockNum === 0 ? 'Agotado (0)' : (stockNum + ' unid.');
        var imgUrl   = p.imagen || p.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png';

        var badgeTag = p.badge
            ? '<span class="d-status d-status--enviado" style="font-size:0.65rem;margin-left:6px;">' + esc(p.badge) + '</span>'
            : '';

        return '<tr>' +
            '<td>' +
                '<img src="' + esc(imgUrl) + '" alt="' + esc(p.nombre) + '" ' +
                'style="width:44px;height:44px;object-fit:contain;border-radius:6px;border:1px solid var(--d-borde);background:var(--d-fondo);padding:2px;" ' +
                'onerror="this.src=\'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png\'">' +
            '</td>' +
            '<td>' +
                '<div style="font-weight:700;font-size:0.88rem;color:var(--d-texto);">' + esc(p.nombre) + badgeTag + '</div>' +
                '<div style="font-size:0.75rem;color:var(--d-texto-mut);max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(p.descripcion || 'Sin descripción') + '</div>' +
            '</td>' +
            '<td><span class="d-status d-status--nuevo">' + esc(p.categoria) + '</span></td>' +
            '<td style="font-weight:700;font-family:var(--d-font-head);">' + formatoCOP(p.precio) + '</td>' +
            '<td><span class="d-status ' + stockCls + '">' + stockTxt + '</span></td>' +
            '<td>' +
                (stockNum > 0
                    ? '<span class="d-status d-status--activo">Disponible</span>'
                    : '<span class="d-status d-status--cancelado">Agotado</span>') +
            '</td>' +
            '<td>' +
                '<div class="d-action-btns">' +
                    '<button class="d-btn-icon" title="Editar producto" onclick="DRender.abrirModalProducto(\'' + esc(p.id) + '\')">' +
                        '<i class="ri-edit-line" aria-hidden="true"></i>' +
                    '</button>' +
                    '<button class="d-btn-icon eliminar" title="Eliminar producto" onclick="DRender.eliminarProductoUI(\'' + esc(p.id) + '\')">' +
                        '<i class="ri-delete-bin-6-line" aria-hidden="true"></i>' +
                    '</button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    }).join('');
}

/**
 * Abre el modal para crear o editar un producto.
 * @param {string|null} id 
 */
export function abrirModalProducto(id) {
    var form       = document.getElementById('form-producto');
    var overlay    = document.getElementById('modal-prod-overlay');
    var tituloTxt  = document.getElementById('modal-prod-titulo-txt');
    var btnGuardar = document.getElementById('prod-btn-guardar-txt');
    if (!form || !overlay) return;

    form.reset();

    if (id) {
        var prods = getProductos();
        var p = Array.isArray(prods) ? prods.find(function (x) { return x && String(x.id) === String(id); }) : null;
        if (!p) return;
        document.getElementById('prod-id').value          = p.id;
        document.getElementById('prod-nombre').value      = p.nombre || p.name || '';
        document.getElementById('prod-categoria').value   = p.categoria || p.category || 'Suplementos';
        document.getElementById('prod-precio').value      = p.precio !== undefined ? p.precio : (p.price || 0);
        document.getElementById('prod-stock').value       = p.stock || 0;
        document.getElementById('prod-badge').value       = p.badge || '';
        document.getElementById('prod-imagen').value      = p.imagen || p.image_url || '';
        document.getElementById('prod-descripcion').value = p.descripcion || p.description || '';
        if (tituloTxt) tituloTxt.textContent = 'Editar: ' + (p.nombre || p.name);
        if (btnGuardar) btnGuardar.textContent = 'Guardar Cambios';
    } else {
        document.getElementById('prod-id').value = '';
        if (tituloTxt) tituloTxt.textContent = 'Nuevo Producto';
        if (btnGuardar) btnGuardar.textContent = 'Guardar Producto';
    }

    overlay.classList.add('d-modal--visible');
    overlay.setAttribute('aria-hidden', 'false');
    var firstInput = document.getElementById('prod-nombre');
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 150);
}

/**
 * Cierra el modal de productos.
 */
export function cerrarModalProducto() {
    var overlay = document.getElementById('modal-prod-overlay');
    if (overlay) {
        overlay.classList.remove('d-modal--visible');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

/**
 * Maneja la confirmación y eliminación de un producto desde la UI.
 * @param {string} id 
 */
export async function eliminarProductoUI(id) {
    var prods = getProductos();
    var p = Array.isArray(prods) ? prods.find(function (x) { return x && String(x.id) === String(id); }) : null;
    if (!p) return;
    if (!confirm('¿Eliminar "' + (p.nombre || p.name) + '" del catálogo? Se actualizará inmediatamente en la tienda.')) return;

    var ok = await eliminarProducto(id);
    if (ok) {
        renderProductosAdmin();
        DSidebar.actualizarBadges();
        DToast.ok('Producto eliminado del catálogo.');
    } else {
        DToast.error('No se pudo eliminar el producto.');
    }
}

/**
 * Configura los eventos del formulario y modal de productos.
 */
export function configurarFormProducto() {
    var form        = document.getElementById('form-producto');
    var overlay     = document.getElementById('modal-prod-overlay');
    var btnCancelar = document.getElementById('modal-prod-cancelar');

    if (!form) return;

    if (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) cerrarModalProducto();
        });
    }
    if (btnCancelar) {
        btnCancelar.addEventListener('click', cerrarModalProducto);
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay && overlay.classList.contains('d-modal--visible')) {
            cerrarModalProducto();
        }
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        var id          = document.getElementById('prod-id').value;
        var nombre      = document.getElementById('prod-nombre').value.trim();
        var categoria   = document.getElementById('prod-categoria').value;
        var precio      = parseInt(document.getElementById('prod-precio').value, 10);
        var stock       = parseInt(document.getElementById('prod-stock').value, 10);
        var badge       = document.getElementById('prod-badge').value.trim();
        var imagen      = document.getElementById('prod-imagen').value.trim();
        var descripcion = document.getElementById('prod-descripcion').value.trim();

        if (!nombre) {
            DToast.error('El nombre del producto es obligatorio.');
            return;
        }
        if (isNaN(precio) || precio < 0) {
            DToast.error('Ingresa un precio válido.');
            return;
        }
        if (isNaN(stock) || stock < 0) {
            DToast.error('Ingresa una cantidad de stock válida.');
            return;
        }
        if (!imagen) {
            DToast.error('La URL de la imagen es obligatoria.');
            return;
        }

        try {
            var guardado = await guardarProducto({
                id: id,
                nombre: nombre,
                name: nombre,
                categoria: categoria,
                category: categoria,
                precio: precio,
                price: precio,
                stock: stock,
                badge: badge,
                imagen: imagen,
                image_url: imagen,
                descripcion: descripcion,
                description: descripcion
            });

            if (guardado) {
                cerrarModalProducto();
                renderProductosAdmin();
                DSidebar.actualizarBadges();
                DToast.ok(id ? 'Producto actualizado correctamente.' : '¡Producto creado y publicado en la tienda!');
            } else {
                DToast.error('Error al guardar el producto.');
            }
        } catch (err) {
            console.error('[dashboard-productos] Error al guardar producto:', err);
            DToast.error('Error al guardar el producto.');
        }
    });
}
