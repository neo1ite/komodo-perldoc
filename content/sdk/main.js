(function() {
    const log       = require("ko/logging").getLogger("komodo-perldoc");
    const docs      = require("scope-docs/docs");
    const augmenter = require("./viewer");
    const $         = require("ko/dom");
    const _window   = require("ko/windows").getMain();

    var loaded = false;
    var originalPreview = null;
    var serial = 0;

    function currentBrowser() {
        var preview = $("#doc-preview", _window);
        if (!preview.length) return null;
        return preview.element();
    }

    this.load = function() {
        if (loaded) return;

        originalPreview = docs.preview;
        if (typeof originalPreview != "function") {
            throw new Error("scope-docs preview API is not available");
        }

        // Let Komodo create and render its own Documentation browser exactly as
        // before.  We only remember the selected entry and augment that browser
        // after the stock renderer has populated it.
        docs.preview = function(index, type) {
            serial++;
            var requestSerial = serial;
            var result = originalPreview.apply(docs, arguments);

            if (index !== undefined && index !== null && index !== "") {
                augmenter.schedule(index, requestSerial, currentBrowser());
            }

            return result;
        };
        docs.preview.__komodoPerldoc = true;

        loaded = true;
        log.warn("Komodo Perldoc 0.1.2 loaded");
    };

    this.unload = function() {
        if (!loaded) return;

        if (docs.preview && docs.preview.__komodoPerldoc) {
            docs.preview = originalPreview;
        }

        originalPreview = null;
        loaded = false;
    };
}).apply(module.exports);
