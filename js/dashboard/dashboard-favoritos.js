/**
 * js/dashboard/dashboard-favoritos.js
 * Vista de favoritos del cliente conectada al 100% con la tabla `favorites` de Supabase.
 */

import { obtenerClienteSupabase, esc, formatoCOP, vacio, DToast } from './dashboard-common.js';
import { getProductos } from './dashboard-productos.js';

/**
 * Consulta los favoritos del usuario en Supabase con la relación de productos.
 * @param {string} uid 
 * @returns {Promise<Array>}
 */
export async function getFavoritos(uid) {
    if (!uid) return [];
    var supabase = await obtenerClienteSupabase();
    if (!supabase) return [];

    try {
        var usuarioId = uid;
        var { data, error } = await supabase
            .from('favorites')
            .select('*, products(*)')
            .eq('user_id', usuarioId)
            .order('created_at', { ascending: false });

        if (error || !Array.isArray(data)) return [];
        return data;
    } catch (e) {
        console.error('[dashboard-favoritos] Error al obtener favoritos de Supabase:', e);
        return [];
    }
}

/**
 * Agrega o quita un producto de los favoritos del usuario en Supabase.
 * @param {string} uid 
 * @param {Object} item 
 * @returns {Promise<boolean>} true si se agregó, false si se quitó
 */
export async function toggleFavorito(uid, item) {
    var supabase = await obtenerClienteSupabase();
    if (!supabase) {
        throw new Error('Supabase client no está inicializado');
    }

    try {
        var { data: existing, error: checkError } = await supabase
            .from('favorites')
            .select('*')
            .eq('user_id', uid)
            .eq('product_id', item.id)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            throw new Error('Error al verificar favorito: ' + checkError.message);
        }

        if (existing) {
            var { error: delError } = await supabase
                .from('favorites')
                .delete()
                .eq('user_id', uid)
                .eq('product_id', item.id);

            if (delError) {
                throw new Error('Error al eliminar favorito: ' + delError.message);
            }
            return false;
        } else {
            var { error: insError } = await supabase
                .from('favorites')
                .insert({
                    user_id: uid,
                    product_id: item.id
                });

            if (insError) {
                throw new Error('Error al agregar favorito: ' + insError.message);
            }
            return true;
        }
    } catch (e) {
        console.error('[dashboard-favoritos] Error al toggle favorito:', e);
        throw e;
    }
}

/**
 * Renderiza la cuadrícula de favoritos del cliente en `#cliente-favs-grid`.
 * @param {Object} usuario 
 */
export async function renderFavoritos(usuario) {
    var el = document.getElementById('cliente-favs-grid');
    if (!el) return;

    var usuarioActual = usuario || (typeof AuthService !== 'undefined' && AuthService.getCurrentUser ? AuthService.getCurrentUser() : null);
    if (!usuarioActual && typeof window.Dashboard !== 'undefined' && window.Dashboard.getUsuario) {
        usuarioActual = window.Dashboard.getUsuario();
    }
    if (!usuarioActual || !usuarioActual.id) {
        el.innerHTML = '<div style="grid-column:1/-1;">' +
            vacio('ri-heart-line', 'Sin favoritos', 'Inicia sesión para ver tus productos favoritos.') +
            '</div>';
        return;
    }

    var supabase = await obtenerClienteSupabase();
    if (!supabase) {
        el.innerHTML = '<div style="grid-column:1/-1;">' +
            vacio('ri-wifi-off-line', 'Sin conexión', 'No se pudo conectar con el servicio de Supabase.') +
            '</div>';
        return;
    }

    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;">' +
        '<div class="spinner-border text-success" role="status"><span class="visually-hidden">Cargando...</span></div>' +
        '<p class="text-muted mt-2 small">Cargando tus favoritos desde Supabase...</p></div>';

    var favs = [];
    try {
        var usuarioId = usuarioActual.id;
        var res = await supabase
            .from('favorites')
            .select('*, products(*)')
            .eq('user_id', usuarioId);

        if (res && !res.error && Array.isArray(res.data)) {
            favs = res.data;
        } else {
            favs = [];
        }
    } catch (err) {
        console.error('[dashboard-favoritos] Error al consultar favoritos en Supabase:', err);
        favs = [];
    }

    if (!Array.isArray(favs) || favs.length === 0) {
        el.innerHTML = '<div style="grid-column:1/-1;">' +
            vacio('ri-heart-line', 'Sin favoritos', 'Aún no has guardado productos favoritos en tu lista.') +
            '<div style="text-align:center;margin-top:16px;">' +
            '<a href="paginas/productos.html" class="d-btn d-btn--primario d-btn--sm">' +
            '<i class="ri-shopping-bag-line"></i> Explorar Catálogo</a></div>' +
            '</div>';
        return;
    }

    el.innerHTML = favs.map(function (f) {
        var p = f && f.products ? f.products : {};
        var prodId = (f && f.product_id) || p.id || '';
        var prodNombre = p.name || 'Producto';
        var prodPrecio = Number(p.price) || 0;
        var prodCat = p.category ? (p.category.charAt(0).toUpperCase() + p.category.slice(1)) : 'Fitness';
        var prodImg = p.image_url || '';

        var imgHtml = prodImg
            ? '<img src="' + esc(prodImg) + '" alt="' + esc(prodNombre) + '" loading="lazy" onerror="this.src=\'https://res.cloudinary.com/atexcbli/image/upload/f_auto/q_auto/logo.png\'">'
            : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--d-plata);font-size:2.2rem;"><i class="ri-article-line"></i></div>';

        var botonComprar = prodPrecio > 0 ?
            '<button class="d-btn d-btn--primario d-btn--sm" style="padding:6px 12px;font-size:0.75rem;" title="Agregar al carrito" onclick="DRender.agregarFavoritoAlCarrito(\'' + esc(prodId) + '\')">' +
            '<i class="ri-shopping-cart-2-line"></i> Comprar</button>' : '';

        return '<div class="d-fav-card">' +
            '<div class="d-fav-card__img">' + imgHtml + '</div>' +
            '<div class="d-fav-card__body">' +
            '<div class="d-fav-card__tag">' + esc(prodCat) + '</div>' +
            '<div class="d-fav-card__name">' + esc(prodNombre) + '</div>' +
            '<div class="d-fav-card__foot">' +
            '<span class="d-fav-card__price">' + (prodPrecio > 0 ? formatoCOP(prodPrecio) : 'Artículo') + '</span>' +
            '<div style="display:flex;gap:6px;align-items:center;">' +
            botonComprar +
            '<button class="d-btn-icon eliminar" title="Quitar de favoritos" onclick="DRender.quitarFavorito(\'' + esc(prodId) + '\',\'' + esc(usuarioActual.id) + '\')">' +
            '<i class="ri-heart-fill" style="color:var(--d-vino);" aria-hidden="true"></i></button>' +
            '</div></div></div></div>';
    }).join('');
}

/**
 * Elimina un favorito de Supabase y refresca la vista.
 * @param {string} favId 
 * @param {string} uid 
 */
export async function quitarFavorito(favId, uid) {
    var supabase = await obtenerClienteSupabase();
    if (!supabase) {
        DToast.error('Conexión con Supabase no disponible.');
        return;
    }

    var usuarioActual = (typeof AuthService !== 'undefined' && AuthService.getCurrentUser ? AuthService.getCurrentUser() : null);
    if (!usuarioActual && typeof window.Dashboard !== 'undefined' && window.Dashboard.getUsuario) {
        usuarioActual = window.Dashboard.getUsuario();
    }
    var targetUid = uid || (usuarioActual ? usuarioActual.id : null);

    if (!targetUid) {
        DToast.error('No se pudo identificar la sesión del usuario.');
        return;
    }

    try {
        var { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', targetUid)
            .eq('product_id', favId);

        if (error) throw error;

        DToast.ok('Eliminado de favoritos.');
        renderFavoritos(usuarioActual || { id: targetUid });
    } catch (e) {
        console.error('[dashboard-favoritos] Error al eliminar favorito de Supabase:', e);
        DToast.error('No se pudo eliminar el favorito.');
    }
}

/**
 * Agrega un producto favorito al carrito de compras de la tienda.
 * @param {string} favId 
 */
export async function agregarFavoritoAlCarrito(favId) {
    var prod = null;
    var supabase = await obtenerClienteSupabase();
    if (supabase) {
        try {
            var { data } = await supabase.from('products').select('*').eq('id', favId).single();
            if (data) {
                prod = {
                    id:        data.id,
                    nombre:    data.name,
                    precio:    Number(data.price) || 0,
                    imagen:    data.image_url,
                    categoria: data.category
                };
            }
        } catch (e) {}
    }

    if (!prod) {
        var prods = getProductos();
        var pMatch = Array.isArray(prods) ? prods.find(function (p) { return p && String(p.id) === String(favId); }) : null;
        if (pMatch) {
            prod = {
                id:        pMatch.id,
                nombre:    pMatch.name || pMatch.nombre,
                precio:    pMatch.price || pMatch.precio,
                imagen:    pMatch.image_url || pMatch.imagen,
                categoria: pMatch.category || pMatch.categoria
            };
        }
    }

    if (!prod) {
        DToast.error('No se pudo encontrar la información del producto.');
        return;
    }

    if (typeof CarritoService !== 'undefined' && CarritoService.agregar) {
        CarritoService.agregar(prod);
        DToast.ok('"' + (prod.nombre || 'Producto') + '" agregado al carrito.');
    } else {
        DToast.error('El servicio de carrito no está disponible.');
    }
}
