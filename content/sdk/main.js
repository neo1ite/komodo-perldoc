(function() {
    const log       = require("ko/logging").getLogger("komodo-perldoc");
    const commando  = require("commando/commando");
    const docs      = require("scope-docs/docs");
    const augmenter = require("./viewer");
    const timers    = require("sdk/timers");

    var loaded = false;
    var originalPreview = null;
    var originalOnPreviewReady = null;
    var pending = null;
    var serial = 0;

    function isPerlScope() {
        var subscope = commando.getSubscope();
        return !!(subscope && subscope.name == "Perl");
    }

    this.load = function() {
        if (loaded) return;

        originalPreview = docs.preview;
        originalOnPreviewReady = docs.onPreviewReady;

        if (typeof originalPreview != "function" || typeof originalOnPreviewReady != "function") {
            throw new Error("scope-docs preview API is not available");
        }

        // Keep the stock viewer completely intact.  We only remember which
        // Perl entry is being opened, then augment the already-rendered page.
        docs.preview = function(index, type) {
            serial++;
            pending = isPerlScope() ? {
                index: index,
                type: type || "preview",
                serial: serial
            } : null;

            return originalPreview.apply(docs, arguments);
        };
        docs.preview.__komodoPerldoc = true;

        docs.onPreviewReady = function() {
            var request = pending;
            var result = originalOnPreviewReady.apply(docs, arguments);

            if (request) {
                // Stock onPreviewReady schedules its scope.info() callback first.
                // Run our augmentation one event-loop turn later so we never race
                // or overwrite the stock Documentation renderer.
                timers.setTimeout(function() {
                    if (!pending || pending.serial != request.serial) return;
                    augmenter.augment(request.index, request.serial);
                }, 0);
            }

            return result;
        };
        docs.onPreviewReady.__komodoPerldoc = true;

        loaded = true;
        log.info("Komodo Perldoc 0.1.1 loaded");
    };

    this.unload = function() {
        if (!loaded) return;

        if (docs.preview && docs.preview.__komodoPerldoc) {
            docs.preview = originalPreview;
        }
        if (docs.onPreviewReady && docs.onPreviewReady.__komodoPerldoc) {
            docs.onPreviewReady = originalOnPreviewReady;
        }

        pending = null;
        originalPreview = null;
        originalOnPreviewReady = null;
        loaded = false;
    };
}).apply(module.exports);
