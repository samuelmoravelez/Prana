/**
 * js/dashboard/dashboard-blog.js
 * Lógica CRUD de entradas en la tabla `blog_posts` de Supabase y gestión administrativa del blog.
 */

import { obtenerClienteSupabase, esc, formatoFecha, vacio, DToast } from './dashboard-common.js';

var _blogCache = [];

// ── CRUD BLOG EN SUPABASE ────────────────────────────────────────────────────
/**
 * Obtiene los artículos del blog directamente desde Supabase.
 * @returns {Promise<Array>} Lista de artículos del blog
 */
export async function getBlog() {
    try {
        const supabase = await obtenerClienteSupabase();
        if (supabase) {
            const { data: posts, error } = await supabase
                .from('blog_posts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[dashboard-blog] Error al consultar blog_posts en Supabase:', error);
            } else if (Array.isArray(posts)) {
                _blogCache = posts.map(function (p) {
                    return {
                        id:         p.id,
                        title:      p.title,
                        titulo:     p.title,
                        category:   p.category,
                        categoria:  p.category,
                        content:    p.content || '',
                        extracto:   p.content || '',
                        image_url:  p.image_url || '',
                        imagen:     p.image_url || '',
                        author:     p.author || 'Admin Prana',
                        autor:      p.author || 'Admin Prana',
                        created_at: p.created_at,
                        fecha:      p.created_at,
                        updated_at: p.updated_at,
                        editadoEn:  p.updated_at,
                        publicado:  true
                    };
                });
            }
        }
    } catch (err) {
        console.error('[dashboard-blog] Excepción al obtener blog_posts:', err);
    }

    return Array.isArray(_blogCache) ? _blogCache : [];
}

export function setBlog(b) {
    var arr = Array.isArray(b) ? b : [];
    _blogCache = arr;
}

/**
 * Inserta un nuevo artículo en la tabla `blog_posts` de Supabase.
 * @param {Object} datos
 * @returns {Promise<Object>}
 */
export async function crearPost(datos) {
    const supabase = await obtenerClienteSupabase();
    if (!supabase) {
        throw new Error('Supabase client no está inicializado');
    }

    var postNormalizado = {
        title: (datos.title || datos.titulo || '').trim(),
        category: datos.category || datos.categoria,
        content: (datos.content || datos.extracto || '').trim(),
        image_url: (datos.image_url || datos.imagen || '').trim(),
        author: datos.author || datos.autor || 'Admin Prana'
    };

    try {
        var { data, error } = await supabase
            .from('blog_posts')
            .insert(postNormalizado)
            .select()
            .single();

        if (error) {
            throw new Error('Error al crear post: ' + error.message);
        }

        var nuevo = {
            id:         data.id,
            title:      data.title,
            titulo:     data.title,
            category:   data.category,
            categoria:  data.category,
            content:    data.content || '',
            extracto:   data.content || '',
            image_url:  data.image_url || '',
            imagen:     data.image_url || '',
            author:     data.author || 'Admin Prana',
            autor:      data.author || 'Admin Prana',
            created_at: data.created_at,
            fecha:      data.created_at,
            updated_at: data.updated_at,
            editadoEn:  data.updated_at,
            publicado:  true
        };

        _blogCache.unshift(nuevo);
        return nuevo;
    } catch (e) {
        console.error('[dashboard-blog] Error al crear post en Supabase:', e);
        throw e;
    }
}

/**
 * Actualiza un artículo existente en la tabla `blog_posts` de Supabase.
 * @param {string} id
 * @param {Object} datos
 * @returns {Promise<boolean>}
 */
export async function actualizarPost(id, datos) {
    const supabase = await obtenerClienteSupabase();
    if (!supabase) {
        throw new Error('Supabase client no está inicializado');
    }

    var postNormalizado = {
        title: (datos.title || datos.titulo || '').trim(),
        category: datos.category || datos.categoria,
        content: (datos.content || datos.extracto || '').trim()
    };

    if (typeof datos.image_url !== 'undefined' || typeof datos.imagen !== 'undefined') {
        postNormalizado.image_url = (datos.image_url || datos.imagen || '').trim();
    }

    try {
        var { error } = await supabase
            .from('blog_posts')
            .update(postNormalizado)
            .eq('id', id);

        if (error) {
            throw new Error('Error al actualizar post: ' + error.message);
        }

        var idx = _blogCache.findIndex(function(p) { return String(p.id) === String(id); });
        if (idx >= 0) {
            _blogCache[idx].title = postNormalizado.title;
            _blogCache[idx].titulo = postNormalizado.title;
            _blogCache[idx].category = postNormalizado.category;
            _blogCache[idx].categoria = postNormalizado.category;
            _blogCache[idx].content = postNormalizado.content;
            _blogCache[idx].extracto = postNormalizado.content;
            if (postNormalizado.image_url !== undefined) {
                _blogCache[idx].image_url = postNormalizado.image_url;
                _blogCache[idx].imagen = postNormalizado.image_url;
            }
        }

        return true;
    } catch (e) {
        console.error('[dashboard-blog] Error al actualizar post en Supabase:', e);
        throw e;
    }
}

/**
 * Elimina un artículo de la tabla `blog_posts` de Supabase.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function eliminarPost(id) {
    const supabase = await obtenerClienteSupabase();
    if (!supabase) {
        throw new Error('Supabase client no está inicializado');
    }

    try {
        var { error } = await supabase
            .from('blog_posts')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error('Error al eliminar post: ' + error.message);
        }

        _blogCache = _blogCache.filter(function(p) { return String(p.id) !== String(id); });
        return true;
    } catch (e) {
        console.error('[dashboard-blog] Error al eliminar post en Supabase:', e);
        throw e;
    }
}

// ── RENDER TABLA / LISTA BLOG ADMIN ──────────────────────────────────────────
/**
 * Consulta la tabla `blog_posts` de Supabase de manera asíncrona y renderiza
 * las publicaciones en el panel de administración.
 */
export async function renderBlogAdmin() {
    var el  = document.getElementById('admin-blog-list');
    var cnt = document.getElementById('blog-count');
    if (!el) return;

    // Estado de carga inicial con spinner
    el.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Cargando artículos...</span></div></div>';

    var posts = [];
    try {
        const supabase = await obtenerClienteSupabase();
        if (supabase) {
            const { data, error } = await supabase
                .from('blog_posts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[dashboard-blog] Error al consultar blog_posts en Supabase:', error);
            } else if (Array.isArray(data)) {
                posts = data;
            }
        }
    } catch (err) {
        console.error('[dashboard-blog] Excepción al consultar blog_posts:', err);
    }

    if (posts.length === 0 && _blogCache.length > 0) {
        posts = _blogCache;
    }

    // Actualizar caché interno
    _blogCache = posts.map(function (p) {
        return {
            id:         p.id,
            title:      p.title,
            titulo:     p.title,
            category:   p.category,
            categoria:  p.category,
            content:    p.content || '',
            extracto:   p.content || '',
            image_url:  p.image_url || '',
            imagen:     p.image_url || '',
            author:     p.author || 'Admin Prana',
            autor:      p.author || 'Admin Prana',
            created_at: p.created_at,
            fecha:      p.created_at,
            updated_at: p.updated_at,
            editadoEn:  p.updated_at,
            publicado:  true
        };
    });

    if (cnt) {
        cnt.textContent = posts.length + ' post' + (posts.length !== 1 ? 's' : '');
    }

    if (!Array.isArray(posts) || posts.length === 0) {
        el.innerHTML = vacio('ri-article-line', 'Sin artículos', 'Publica tu primer artículo del blog.');
        return;
    }

    // Renderizar utilizando las columnas exactas: id, title, category, author, created_at, image_url
    el.innerHTML = posts.map(function (p) {
        var id        = p.id;
        var title     = p.title || p.titulo || 'Artículo sin título';
        var category  = p.category || p.categoria || 'General';
        var author    = p.author || p.autor || 'Admin Prana';
        var createdAt = p.created_at || p.fecha;
        var imageUrl  = p.image_url || p.imagen || '';

        var imgHtml = imageUrl
            ? '<img src="' + esc(imageUrl) + '" alt="' + esc(title) + '" style="width:42px;height:42px;object-fit:cover;border-radius:6px;border:1px solid var(--d-borde);" onerror="this.onerror=null;this.src=\'https://res.cloudinary.com/atexcbli/image/upload/v1791240543/nhm.webp\';">'
            : '<div class="d-post-item__icon"><i class="ri-article-line" aria-hidden="true"></i></div>';

        return '<div class="d-post-item" data-id="' + esc(id) + '">' +
            imgHtml +
            '<div class="d-post-item__info">' +
            '<div class="d-post-item__titulo">' + esc(title) + '</div>' +
            '<div class="d-post-item__meta">' + esc(category) + ' · Por ' + esc(author) + ' · ' + formatoFecha(createdAt) + '</div>' +
            '</div>' +
            '<div class="d-action-btns">' +
            '<button class="d-btn-icon" title="Editar" onclick="DRender.editarPost(\'' + esc(id) + '\')">' +
            '<i class="ri-edit-line" aria-hidden="true"></i></button>' +
            '<button class="d-btn-icon eliminar" title="Eliminar" onclick="DRender.eliminarPostUI(\'' + esc(id) + '\')">' +
            '<i class="ri-delete-bin-6-line" aria-hidden="true"></i></button>' +
            '</div></div>';
    }).join('');
}

export var renderTablaBlogAdmin = renderBlogAdmin;

/**
 * Carga un artículo en el formulario para su edición.
 * @param {string} id
 */
export async function editarPost(id) {
    var post = _blogCache.find(function (p) { return p && String(p.id) === String(id); });
    if (!post) {
        const supabase = await obtenerClienteSupabase();
        if (supabase) {
            const { data } = await supabase.from('blog_posts').select('*').eq('id', id).single();
            if (data) {
                post = {
                    id:         data.id,
                    title:      data.title,
                    titulo:     data.title,
                    category:   data.category,
                    categoria:  data.category,
                    content:    data.content || '',
                    extracto:   data.content || '',
                    image_url:  data.image_url || '',
                    imagen:     data.image_url || '',
                    author:     data.author || 'Admin Prana',
                    autor:      data.author || 'Admin Prana'
                };
            }
        }
    }
    if (!post) return;

    var setVal = function(elemId, val) {
        var el = document.getElementById(elemId);
        if (el) el.value = val || '';
    };

    setVal('blog-id-edit', post.id);
    setVal('blog-titulo', post.title || post.titulo);
    setVal('blog-categoria', post.category || post.categoria);
    setVal('blog-imagen', post.image_url || post.imagen || '');
    setVal('blog-extracto', post.content || post.extracto);

    var btnTxt = document.getElementById('blog-btn-texto');
    if (btnTxt) btnTxt.textContent = 'Actualizar';

    var formTitulo = document.querySelector('#blog-form-titulo');
    if (formTitulo) {
        formTitulo.innerHTML = '<i class="ri-edit-2-line" aria-hidden="true"></i> Editar Artículo';
    }

    var form = document.getElementById('form-blog');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Elimina un post previa confirmación y refresca la tabla desde Supabase.
 * @param {string} id
 */
export async function eliminarPostUI(id) {
    if (!confirm('¿Eliminar este artículo? Esta acción no se puede deshacer.')) return;
    try {
        await eliminarPost(id);
        await renderBlogAdmin();
        DToast.ok('Artículo eliminado.');
    } catch (e) {
        DToast.error('No se pudo eliminar el artículo.');
    }
}

/**
 * Configura los eventos del formulario de creación y edición de posts.
 * @param {Function} getUsuarioFn
 */
export function configurarFormBlog(getUsuarioFn) {
    var form = document.getElementById('form-blog');
    if (!form) return;

    var btnCancelar = document.getElementById('blog-btn-cancelar');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', function () {
            form.reset();
            var idEl = document.getElementById('blog-id-edit');
            if (idEl) idEl.value = '';
            var imgEl = document.getElementById('blog-imagen');
            if (imgEl) imgEl.value = '';
            var btnTxt = document.getElementById('blog-btn-texto');
            if (btnTxt) btnTxt.textContent = 'Publicar';
            var formTitulo = document.querySelector('#blog-form-titulo');
            if (formTitulo) {
                formTitulo.innerHTML = '<i class="ri-edit-2-line"></i> Nuevo Artículo';
            }
        });
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        var titulo    = document.getElementById('blog-titulo').value.trim();
        var categoria = document.getElementById('blog-categoria').value;
        var imagen    = document.getElementById('blog-imagen') ? document.getElementById('blog-imagen').value.trim() : '';
        var extracto  = document.getElementById('blog-extracto').value.trim();
        var idEdit    = document.getElementById('blog-id-edit').value;

        if (!titulo || !extracto) {
            DToast.error('Completa el título y el extracto del artículo.');
            return;
        }

        var usuario = getUsuarioFn ? getUsuarioFn() : null;
        var autorNombre = (usuario && (usuario.nombre || usuario.name)) || 'Admin Prana';

        try {
            if (idEdit) {
                await actualizarPost(idEdit, { title: titulo, category: categoria, content: extracto, image_url: imagen });
                DToast.ok('Artículo actualizado exitosamente.');
            } else {
                await crearPost({ title: titulo, category: categoria, content: extracto, image_url: imagen, author: autorNombre });
                DToast.ok('Artículo publicado exitosamente.');
            }

            form.reset();
            var idEl = document.getElementById('blog-id-edit');
            if (idEl) idEl.value = '';
            var imgInput = document.getElementById('blog-imagen');
            if (imgInput) imgInput.value = '';
            var btnTxt = document.getElementById('blog-btn-texto');
            if (btnTxt) btnTxt.textContent = 'Publicar';
            var formTitulo = document.querySelector('#blog-form-titulo');
            if (formTitulo) {
                formTitulo.innerHTML = '<i class="ri-edit-2-line"></i> Nuevo Artículo';
            }

            await renderBlogAdmin();
        } catch (err) {
            console.error('[dashboard-blog] Error al guardar post:', err);
            DToast.error('Error al guardar el artículo en Supabase.');
        }
    });
}
