// js/utils/hash.js
// Responsabilidad: hashear contraseñas de forma segura antes de persistirlas.
// Usa la Web Crypto API nativa (SHA-256) con salt aleatorio.
//
// NOTA DE ARQUITECTURA:
// El hashing en el navegador NO reemplaza el hashing en servidor. Se usa aquí
// para no almacenar contraseñas en texto plano en localStorage. Si en el futuro
// se migra a una API / Supabase / Firebase, esta utilidad se mantiene como capa
// de seguridad adicional o se elimina (el backend se encargaría del hashing).

var Hash = (function () {

    'use strict';

    // Longitud del salt en bytes (16 bytes = 32 caracteres hex)
    var SALT_LENGTH = 16;

    /**
     * Convierte un ArrayBuffer a string hexadecimal.
     */
    function bufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(function (b) { return b.toString(16).padStart(2, '0'); })
            .join('');
    }

    /**
     * Codifica un string a ArrayBuffer (UTF-8).
     */
    function stringToBuffer(str) {
        return new TextEncoder().encode(str);
    }

    /**
     * Genera un salt aleatorio en formato hexadecimal.
     * Usa crypto.getRandomValues para entropía criptográfica real.
     */
    function generarSalt() {
        var array = new Uint8Array(SALT_LENGTH);
        crypto.getRandomValues(array);
        return bufferToHex(array.buffer);
    }

    /**
     * Calcula el hash SHA-256 de (salt + contraseña).
     * Retorna una promesa que resuelve a un string hexadecimal.
     *
     * @param {string} password - Contraseña en texto plano
     * @param {string} salt - Salt en hexadecimal
     * @returns {Promise<string>} Hash en hexadecimal
     */
    async function hashPassword(password, salt) {
        var data = stringToBuffer(salt + password);
        var hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return bufferToHex(hashBuffer);
    }

    /**
     * Crea un hash completo con salt incluido, listo para almacenar.
     * Formato devuelto: { salt: string, hash: string }
     *
     * @param {string} password - Contraseña en texto plano
     * @returns {Promise<{salt: string, hash: string}>}
     */
    async function crearHash(password) {
        var salt = generarSalt();
        var hash = await hashPassword(password, salt);
        return { salt: salt, hash: hash };
    }

    /**
     * Verifica si una contraseña coincide con un hash y salt almacenados.
     *
     * @param {string} password - Contraseña en texto plano a verificar
     * @param {string} salt - Salt almacenado
     * @param {string} hashAlmacenado - Hash almacenado
     * @returns {Promise<boolean>} true si coincide
     */
    async function verificarPassword(password, salt, hashAlmacenado) {
        var hashCalculado = await hashPassword(password, salt);
        // Comparación segura en tiempo constante (evita timing attacks)
        if (hashCalculado.length !== hashAlmacenado.length) return false;
        var resultado = 0;
        for (var i = 0; i < hashCalculado.length; i++) {
            resultado |= hashCalculado.charCodeAt(i) ^ hashAlmacenado.charCodeAt(i);
        }
        return resultado === 0;
    }

    // API pública
    return {
        crearHash: crearHash,
        verificarPassword: verificarPassword
    };

})();
