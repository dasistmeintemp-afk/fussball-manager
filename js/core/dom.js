/**
 * DOM-Hilfsfunktionen für robusten und fehlerresistenten DOM-Zugriff
 */

const DOM = {
    /**
     * Element per ID sicher abrufen
     */
    byId(id, required = false) {
        if (typeof document === 'undefined') return null;
        const el = document.getElementById(id);
        if (!el && required) {
            console.warn(`[DOM Warning] Element #${id} nicht gefunden.`);
        }
        return el;
    },

    /**
     * Einzelelement per CSS Selector suchen
     */
    q(selector, root = null) {
        if (typeof document === 'undefined') return null;
        const parent = root || document;
        return parent.querySelector(selector);
    },

    /**
     * Alle Elemente per CSS Selector suchen
     */
    qa(selector, root = null) {
        if (typeof document === 'undefined') return [];
        const parent = root || document;
        return Array.from(parent.querySelectorAll(selector));
    },

    /**
     * Textinhalt sicher setzen
     */
    setText(idOrEl, text) {
        const el = typeof idOrEl === 'string' ? DOM.byId(idOrEl) : idOrEl;
        if (el) {
            el.textContent = text !== null && text !== undefined ? String(text) : "";
        }
    },

    /**
     * HTML-Inhalt sicher setzen
     */
    setHtml(idOrEl, html) {
        const el = typeof idOrEl === 'string' ? DOM.byId(idOrEl) : idOrEl;
        if (el) {
            el.innerHTML = html !== null && html !== undefined ? String(html) : "";
        }
    },

    /**
     * Element einblenden
     */
    show(idOrEl, display = "block") {
        const el = typeof idOrEl === 'string' ? DOM.byId(idOrEl) : idOrEl;
        if (el) {
            el.style.display = display;
        }
    },

    /**
     * Element ausblenden
     */
    hide(idOrEl) {
        const el = typeof idOrEl === 'string' ? DOM.byId(idOrEl) : idOrEl;
        if (el) {
            el.style.display = "none";
        }
    },

    /**
     * Sichtbarkeit umschalten
     */
    toggle(idOrEl, isVisible, display = "block") {
        if (isVisible) {
            DOM.show(idOrEl, display);
        } else {
            DOM.hide(idOrEl);
        }
    },

    /**
     * Event Listener sicher hinzufügen
     */
    on(idOrEl, event, handler) {
        const el = typeof idOrEl === 'string' ? DOM.byId(idOrEl) : idOrEl;
        if (el && typeof el.addEventListener === 'function') {
            el.addEventListener(event, handler);
        }
    }
};

// Global oder Node exportieren
if (typeof window !== "undefined") {
    window.DOM = DOM;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DOM };
}
