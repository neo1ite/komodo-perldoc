(function() {
    const log      = require("ko/logging").getLogger("komodo-perldoc");
    const commando = require("commando/commando");
    const docs     = require("scope-docs/docs");
    const Viewer   = require("./viewer");

    var loaded = false;
    var activeViewer = null;
    var originalPreview = null;
    var originalOnPreviewReady = null;

    function isPerlScope() {
        var subscope = commando.getSubscope();
        return !!(subscope && subscope.name == "Perl");
    }

    this.load = function() {
        if (loaded) return;

        originalPreview = docs.preview;
        originalOnPreviewReady = docs.onPreviewReady;

        docs.preview = function(index, type) {
            if (!isPerlScope()) {
                activeViewer = null;
                return originalPreview.apply(docs, arguments);
            }

            activeViewer = new Viewer(index, type || "preview");
        };
        docs.preview.__komodoPerldoc = true;

        docs.onPreviewReady = function() {
            if (activeViewer) {
                return activeViewer.onReady();
            }
            return originalOnPreviewReady.apply(docs, arguments);
        };
        docs.onPreviewReady.__komodoPerldoc = true;

        loaded = true;
        log.info("Komodo Perldoc 0.1 loaded");
    };

    this.unload = function() {
        if (!loaded) return;

        if (docs.preview && docs.preview.__komodoPerldoc) {
            docs.preview = originalPreview;
        }
        if (docs.onPreviewReady && docs.onPreviewReady.__komodoPerldoc) {
            docs.onPreviewReady = originalOnPreviewReady;
        }

        activeViewer = null;
        originalPreview = null;
        originalOnPreviewReady = null;
        loaded = false;
    };
}).apply(module.exports);
