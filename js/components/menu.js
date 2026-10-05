// js/components/menu.js
// Responsabilidad: menú de navegación hamburguesa.
// Compartido en todas las páginas del sitio.

function iniciarMenu() {
    var btnMenu       = document.getElementById('btn-menu');
    var menuPrincipal = document.getElementById('menu-principal');

    // Si esta página no tiene menú hamburguesa, no hace nada
    if (!btnMenu || !menuPrincipal) return;

    // Abrir / cerrar el menú al pulsar el botón
    btnMenu.addEventListener('click', function() {
        var estaAbierto = menuPrincipal.classList.toggle('abierto');
        btnMenu.classList.toggle('abierto', estaAbierto);
        btnMenu.setAttribute('aria-expanded', estaAbierto);
    });

    // Cerrar el menú al hacer clic en cualquier enlace (comportamiento móvil)
    menuPrincipal.querySelectorAll('a').forEach(function(enlace) {
        enlace.addEventListener('click', function() {
            menuPrincipal.classList.remove('abierto');
            btnMenu.classList.remove('abierto');
            btnMenu.setAttribute('aria-expanded', 'false');
        });
    });
}
