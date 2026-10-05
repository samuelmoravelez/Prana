// js/utils/storage.js
// Responsabilidad: abstrae todas las operaciones de localStorage.
// Centralizar aquí evita duplicar la lógica de persistencia en otros archivos.
// Si en el futuro se cambia el mecanismo de almacenamiento (sessionStorage,
// IndexedDB, API, etc.), solo se modifica este archivo.

var Storage = {

    // Obtiene un valor y lo convierte al tipo adecuado.
    // Retorna el defaultValue si la clave no existe o el valor es inválido.
    obtener: function(clave, defaultValue) {
        var valor = localStorage.getItem(clave);
        if (valor === null || valor === undefined) return defaultValue;
        var numero = Number(valor);
        if (!isNaN(numero)) return numero;
        return valor;
    },

    // Guarda un valor asociado a una clave.
    guardar: function(clave, valor) {
        localStorage.setItem(clave, valor);
    },

    // Elimina una clave del almacenamiento.
    eliminar: function(clave) {
        localStorage.removeItem(clave);
    }

};
