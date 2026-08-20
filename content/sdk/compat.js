(function() {
    const debug    = require("./debug");
    const $        = require("ko/dom");
    const commando = require("commando/commando");
    const _window  = require("ko/windows").getMain();
    const timers   = require("sdk/timers");

    var started = false;
    var results = null;
    var clickHandler = null;
    var originalSelectScope = null;

    function isPerlDocs() {
        try {
            var scope = commando.getScope();
            var subscope = commando.getSubscope();
            return !!(scope && scope.id == "scope-docs" && subscope && subscope.name == "Perl");
        } catch (e) {
            return false;
        }
    }

    function selectedResult() {
        try {
            var selected = $("#commando-results richlistitem[selected='true']", _window);
            if (!selected.length) selected = $("#commando-results [selected='true']", _window);
            if (!selected.length) return null;

            var elem = selected.element();
            var id = elem && elem.id ? String(elem.id) : "";
            var match = /^co-result-item-doc-(\d+)$/.exec(id);
            if (!match) return null;

            return {
                index: match[1],
                id: id,
                text: elem.textContent ? String(elem.textContent).replace(/\s+/g, " ").trim() : ""
            };
        } catch (e) {
            return null;
        }
    }

    function installMousePreviewFix() {
        results = $("#commando-results", _window);
        if (!results.length) {
            debug.trace("compat", "mouse preview fix not installed: #commando-results missing");
            return;
        }

        clickHandler = function() {
            // Komodo 9 Commando updates only the selection/tip on mouse click;
            // unlike keyboard Up/Down it does not call onPreview().  Wait until
            // the XUL richlist selection has settled, then use the same stock
            // preview path as keyboard navigation.
            timers.setTimeout(function() {
                if (!started || !isPerlDocs()) return;
                var selected = selectedResult();
                if (!selected) return;

                if (typeof commando.onPreview != "function") {
                    debug.trace("compat", "cannot refresh clicked Documentation result: commando.onPreview unavailable", {
                        selected: selected
                    });
                    return;
                }

                try {
                    debug.trace("compat", "refreshing stock preview after mouse selection", {
                        selected: selected
                    });
                    commando.onPreview();
                } catch (e) {
                    debug.exception("compat", "stock Commando onPreview() failed after mouse selection", e);
                }
            }, 0);
        };

        results.on("click", clickHandler);
        debug.trace("compat", "installed Komodo 9 mouse-preview compatibility fix");
    }

    function installSelectScopeCallbackFix() {
        if (typeof commando.showSubscope == "function") return;
        if (typeof commando.selectScope != "function") return;

        originalSelectScope = commando.selectScope;
        commando.selectScope = function(scopeId, callback) {
            if (typeof callback != "function" || scopeId != "scope-docs")
                return originalSelectScope.apply(commando, arguments);

            var fired = false;
            var args = Array.prototype.slice.call(arguments);
            var once = function() {
                if (fired) return;
                fired = true;
                return callback.apply(null, arguments);
            };
            args[1] = once;

            var result = originalSelectScope.apply(commando, args);

            // Komodo 9.3's exported CommonJS Commando does not reliably invoke
            // the selectScope callback used by newer showSubscope().  Give the
            // stock implementation time to render the language list and then
            // release the callback once if it never arrived.
            timers.setTimeout(function() {
                if (!started || fired) return;
                debug.trace("compat", "legacy selectScope callback did not fire; releasing fallback callback", {
                    scopeId: scopeId
                });
                once();
            }, 150);

            return result;
        };

        debug.trace("compat", "installed Komodo 9 selectScope callback compatibility fix");
    }

    this.start = function() {
        if (started) return;
        started = true;
        installSelectScopeCallbackFix();
        installMousePreviewFix();
    };

    this.stop = function() {
        if (!started) return;
        started = false;

        if (results && clickHandler) {
            try { results.off("click", clickHandler); } catch (e) {}
        }
        results = null;
        clickHandler = null;

        if (originalSelectScope) {
            try { commando.selectScope = originalSelectScope; } catch (e) {}
            originalSelectScope = null;
        }

        debug.trace("compat", "Komodo 9 compatibility fixes stopped");
    };
}).apply(module.exports);
