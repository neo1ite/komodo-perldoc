(function() {
    const debug    = require("./debug");
    const $        = require("ko/dom");
    const commando = require("commando/commando");
    const _window  = require("ko/windows").getMain();
    const timers   = require("sdk/timers");

    var started = false;
    var results = null;
    var clickHandler = null;
    var originalShowSubscope = null;
    var installedShowSubscopeShim = false;

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

    function returnToCurrentPerlSubscope() {
        if (!isPerlDocs()) {
            debug.trace("compat", "cannot return to Perl root: current Commando state is not Perl documentation");
            return false;
        }

        var panel = $("#commando-panel", _window);
        if (panel.length) {
            panel.removeClass("maximized");
            panel.removeClass("quick-search");
        }

        try {
            // We are already inside scope-docs -> Perl when the synthetic
            // breadcrumb is clicked.  Re-selecting scope-docs drops the Perl
            // subscope and lands on the language list.  Preserve the existing
            // subscope and simply clear the symbol query instead.
            if (typeof commando.clear == "function") {
                commando.clear();
            } else if (typeof commando.search == "function") {
                commando.search("");
            } else {
                debug.trace("compat", "cannot return to Perl root: clear/search APIs unavailable", {
                    clear: typeof commando.clear,
                    search: typeof commando.search
                });
                return false;
            }

            timers.setTimeout(function() {
                try {
                    if (typeof commando.focus == "function") commando.focus();
                } catch (e) {}
            }, 0);

            debug.trace("compat", "returned to existing Perl documentation subscope", {
                via: typeof commando.clear == "function" ? "clear" : "search"
            });
            return true;
        } catch (e) {
            debug.exception("compat", "failed to return to existing Perl documentation subscope", e);
            return false;
        }
    }

    function installShowSubscopeShim() {
        if (typeof commando.showSubscope == "function") return;

        originalShowSubscope = commando.showSubscope;
        commando.showSubscope = function() {
            var args = Array.prototype.slice.call(arguments);
            var scopeId = args.shift();
            var subscopeId = args.shift();

            if (scopeId == "scope-docs" && subscopeId == "docs-Perl") {
                return returnToCurrentPerlSubscope();
            }

            debug.trace("compat", "legacy showSubscope shim received unsupported target", {
                scopeId: scopeId,
                subscopeId: subscopeId
            });
            return false;
        };
        installedShowSubscopeShim = true;

        debug.trace("compat", "installed Komodo 9 showSubscope compatibility shim");
    }

    this.start = function() {
        if (started) return;
        started = true;
        installShowSubscopeShim();
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

        if (installedShowSubscopeShim) {
            try {
                if (originalShowSubscope === undefined)
                    delete commando.showSubscope;
                else
                    commando.showSubscope = originalShowSubscope;
            } catch (e) {}
        }
        originalShowSubscope = null;
        installedShowSubscopeShim = false;

        debug.trace("compat", "Komodo 9 compatibility fixes stopped");
    };
}).apply(module.exports);
