// js/pages/blog.js
// Responsabilidad: lógica de paginas/blog.html.
// — Renderiza dinámicamente los artículos desde la tabla blog_posts de Supabase (PostgreSQL)
// — Columnas exactas de Supabase: id, title, category, image_url, content, author, created_at
// — Filtrado interactivo por categorías
// — Modal de lectura completa del artículo
// — Espera asíncrona segura de inicialización de Supabase con obtenerClienteSupabase()

(function () {

    'use strict';

    // ── Helper de espera asíncrona para inicialización de Supabase ───────────
    async function obtenerClienteSupabase() {
        if (window.supabaseClient) return window.supabaseClient;
        return new Promise(function (resolve) {
            var check = setInterval(function () {
                if (window.supabaseClient) {
                    clearInterval(check);
                    resolve(window.supabaseClient);
                }
            }, 50);
        });
    }

    function formatoFecha(iso) {
        if (!iso) return 'Reciente';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return 'Reciente';
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function obtenerColorBadge(cat) {
        var c = String(cat || '').toLowerCase().trim();
        if (c.indexOf('nutrición') >= 0 || c.indexOf('nutricion') >= 0) return 'bg-success';
        if (c.indexOf('entrenamiento') >= 0) return 'bg-danger';
        if (c.indexOf('suplement') >= 0) return 'bg-warning text-dark';
        if (c.indexOf('indumentaria') >= 0) return 'bg-info text-dark';
        if (c.indexOf('tendencia') >= 0) return 'bg-secondary';
        return 'bg-dark';
    }

    var _postsCargados = [];
    var _categoriaActual = 'todas';

    async function obtenerPosts() {
        try {
            var supabase = await obtenerClienteSupabase();
            var { data, error } = await supabase
                .from('blog_posts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[Blog] Error al consultar blog_posts en Supabase:', error);
                throw error;
            }

            if (!Array.isArray(data)) return [];

            return data.map(function (p) {
                var contenido = p.content || '';
                var palabras = contenido.trim().split(/\s+/).length;
                var minutosLectura = Math.max(3, Math.min(15, Math.ceil(palabras / 120)));

                return {
                    id:         p.id,
                    title:      p.title || 'Publicación del Blog',
                    category:   p.category || 'Fitness',
                    image_url:  p.image_url || 'https://res.cloudinary.com/atexcbli/image/upload/v1791240543/nhm.webp',
                    content:    contenido,
                    author:     p.author || 'Equipo Prana',
                    created_at: p.created_at,
                    minutos:    minutosLectura
                };
            });
        } catch (e) {
            console.error('[Blog] Excepción al obtener posts:', e);
            throw e;
        }
    }

    async function renderizarPosts() {
        var contenedor = document.getElementById('contenedor-blog') ||
                         document.querySelector('section.py-5 .row.g-4');

        if (!contenedor) return;

        // Mostrar spinner de carga si aún no hay artículos cargados
        if (_postsCargados.length === 0) {
            contenedor.innerHTML = [
                '<div class="col-12 text-center py-5">',
                '  <div class="spinner-border text-success" role="status">',
                '    <span class="visually-hidden">Cargando publicaciones...</span>',
                '  </div>',
                '  <p class="text-muted mt-3">Cargando publicaciones desde Supabase...</p>',
                '</div>'
            ].join('');
        }

        try {
            if (_postsCargados.length === 0) {
                _postsCargados = await obtenerPosts();
            }
        } catch (err) {
            contenedor.innerHTML = [
                '<div class="col-12 text-center py-5">',
                '  <i class="ri-wifi-off-line fs-1 text-danger mb-3 d-block"></i>',
                '  <h4 class="fw-bold">No se pudieron cargar las publicaciones</h4>',
                '  <p class="text-muted mb-4">Error al conectar con la base de datos de Supabase. Revisa tu conexión.</p>',
                '  <button id="btn-reintentar-blog" class="btn btn-outline-success">',
                '    <i class="ri-refresh-line me-2"></i>Reintentar',
                '  </button>',
                '</div>'
            ].join('');

            var btnReintentar = document.getElementById('btn-reintentar-blog');
            if (btnReintentar) {
                btnReintentar.addEventListener('click', function () {
                    _postsCargados = [];
                    renderizarPosts();
                });
            }
            return;
        }

        var filtrados = _postsCargados.filter(function (p) {
            if (_categoriaActual === 'todas') return true;
            var c = (p.category || '').toLowerCase().trim();
            var target = _categoriaActual.toLowerCase().trim();
            return c.indexOf(target) >= 0 || target.indexOf(c) >= 0;
        });

        if (filtrados.length === 0) {
            contenedor.innerHTML = [
                '<div class="col-12 text-center py-5">',
                '  <i class="ri-article-line display-4 text-muted mb-3 d-block"></i>',
                '  <h3 class="h5 fw-bold">No hay artículos disponibles en esta categoría</h3>',
                '  <p class="text-muted small">Pronto publicaremos nuevo contenido fitness aquí.</p>',
                '</div>'
            ].join('');
            return;
        }

        contenedor.innerHTML = filtrados.map(function (p) {
            var badgeColor = obtenerColorBadge(p.category);
            var extracto = p.content.length > 140
                ? p.content.slice(0, 140) + '...'
                : p.content;

            return [
                '<article class="col-lg-4 col-md-6 blog-item">',
                '  <div class="card h-100 border-0 shadow-sm rounded-3 overflow-hidden hover-shadow transition">',
                '    <img src="' + esc(p.image_url) + '" class="card-img-top p-3 bg-light" alt="' + esc(p.title) + '" style="height: 220px; object-fit: contain;" loading="lazy" onerror="this.src=\'https://res.cloudinary.com/atexcbli/image/upload/v1791240543/nhm.webp\'">',
                '    <div class="card-body d-flex flex-column">',
                '      <span class="badge ' + badgeColor + ' mb-2 align-self-start">' + esc(p.category) + '</span>',
                '      <h2 class="h5 fw-bold mb-2">' + esc(p.title) + '</h2>',
                '      <p class="text-muted small mb-3 flex-grow-1">' + esc(extracto) + '</p>',
                '      <div class="d-flex align-items-center text-muted small mb-3">',
                '        <i class="far fa-calendar me-2"></i>' + formatoFecha(p.created_at),
                '        <span class="mx-2">•</span>',
                '        <i class="far fa-clock me-2"></i>' + p.minutos + ' min lectura',
                '      </div>',
                '      <button class="btn btn-outline-success mt-auto text-center btn-leer-post" data-post-id="' + esc(p.id) + '">',
                '        Leer artículo <i class="fas fa-arrow-right ms-2"></i>',
                '      </button>',
                '    </div>',
                '  </div>',
                '</article>'
            ].join('');
        }).join('');

        // Eventos en botones para desplegar lectura
        contenedor.querySelectorAll('.btn-leer-post').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var pid = btn.dataset.postId;
                var post = _postsCargados.find(function (x) { return String(x.id) === String(pid); });
                if (post) {
                    _mostrarModalLectura(post);
                }
            });
        });
    }

    function _mostrarModalLectura(post) {
        var modalExistente = document.getElementById('modal-blog-lectura');
        if (modalExistente) modalExistente.remove();

        var modal = document.createElement('div');
        modal.id = 'modal-blog-lectura';
        modal.style.cssText = [
            'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.65)',
            'z-index:10000', 'display:flex', 'align-items:center', 'justify-content:center',
            'padding:20px', 'backdrop-filter:blur(6px)'
        ].join(';');

        var imgHtml = post.image_url
            ? '<img src="' + esc(post.image_url) + '" style="max-height:240px; width:100%; object-fit:contain; background:#f8f9fa; border-radius:10px; margin-bottom:16px;">'
            : '';

        modal.innerHTML = [
            '<div style="background:#fff; border-radius:16px; max-width:680px; width:100%; max-height:85vh; overflow-y:auto; padding:32px; box-shadow:0 20px 50px rgba(0,0,0,0.3); position:relative;">',
            '  <button type="button" id="cerrar-modal-blog" style="position:absolute; top:18px; right:18px; border:none; background:#f0f0f0; width:34px; height:34px; border-radius:50%; font-size:1.2rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">&times;</button>',
            '  <span class="badge bg-success mb-2">' + esc(post.category) + '</span>',
            '  <h2 style="font-family:Poppins,sans-serif; font-weight:800; font-size:1.45rem; color:#3D0712; margin-bottom:8px;">' + esc(post.title) + '</h2>',
            '  <p style="font-size:0.8rem; color:#8A8A8A; margin-bottom:16px;">Por <strong>' + esc(post.author || 'Equipo Prana') + '</strong> · ' + formatoFecha(post.created_at) + ' · ' + post.minutos + ' min lectura</p>',
               imgHtml,
            '  <div style="font-size:0.95rem; line-height:1.8; color:#2C2C2C; margin-bottom:24px; white-space:pre-line;">' + esc(post.content) + '</div>',
            '  <div style="text-align:right;">',
            '    <button type="button" class="btn btn-success px-4" id="btn-cerrar-blog-lectura">Entendido</button>',
            '  </div>',
            '</div>'
        ].join('');

        document.body.appendChild(modal);

        var cerrar = function () { modal.remove(); };
        modal.querySelector('#cerrar-modal-blog').addEventListener('click', cerrar);
        modal.querySelector('#btn-cerrar-blog-lectura').addEventListener('click', cerrar);
        modal.addEventListener('click', function (e) { if (e.target === modal) cerrar(); });
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                cerrar();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }

    function configurarFiltros() {
        var links = document.querySelectorAll('.nav-pills .nav-link');
        links.forEach(function (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                links.forEach(function (l) {
                    l.classList.remove('active', 'bg-success', 'text-white');
                    l.classList.add('text-success');
                });
                link.classList.add('active', 'bg-success', 'text-white');
                link.classList.remove('text-success');

                var texto = link.textContent.trim().toLowerCase();
                if (texto === 'todas') {
                    _categoriaActual = 'todas';
                } else if (texto === 'suplementación' || texto === 'suplementacion') {
                    _categoriaActual = 'suplement';
                } else if (texto === 'tendencias fitness') {
                    _categoriaActual = 'tendencia';
                } else {
                    _categoriaActual = texto;
                }
                renderizarPosts();
            });
        });
    }

    function init() {
        renderizarPosts();
        configurarFiltros();

        // Notificación de actualización en tiempo real desde Supabase o Dashboard
        document.addEventListener('prana:blog_actualizado', function () {
            _postsCargados = [];
            renderizarPosts();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
