(function() {
    const docs      = require("scope-docs/docs");
    const augmenter = require("./viewer");
    const debug     = require("./debug");
    const probe     = require("./probe");
    const $         = require("ko/dom");
    const _window   = require("ko/windows").getMain();

    var loaded = false;
    var originalPreview = null;
    var serial = 0;

    debug.trace("main", "module evaluated", {
        hasDocs: !!docs,
        docsExports: Object.keys(docs).sort(),
        previewType: typeof docs.preview,
        debugLog: debug.path()
    });

    function currentBrowser() {
        var preview = $("#doc-preview", _window);
        if (!preview.length) return null;
        return preview.element();
    }

    function currentSubscope() {
        try {
            var commando = require("commando/commando");
            var subscope = commando.getSubscope();
            if (!subscope) return null;
            return {
                id: subscope.id || null,
                name: subscope.name || null,
                scope: subscope.scope || null
            };
        } catch (e) {
            return {error: String(e)};
        }
    }

    this.load = function() {
        debug.trace("main", "load() entered", {alreadyLoaded: loaded});
        if (loaded) {
            debug.trace("main", "load() ignored: already loaded");
            return;
        }

        // The probe is deliberately independent from docs.preview().  In 0.1.2
        // we proved that the add-on loaded and the preview wrapper was installed,
        // but the wrapper was never called during real Commando navigation.
        // 0.1.3 therefore traces the Commando DOM, preview browser mutations and
        // module export shapes even if scope-docs bypasses this exported method.
        try {
            probe.start();
            debug.trace("main", "independent Commando probe started");
        } catch (e) {
            debug.exception("main", "failed to start independent Commando probe", e);
        }

        originalPreview = docs.preview;
        debug.trace("main", "captured scope-docs preview", {
            type: typeof originalPreview,
            alreadyWrapped: !!(originalPreview && originalPreview.__komodoPerldoc)
        });

        if (typeof originalPreview != "function") {
            var error = new Error("scope-docs preview API is not available");
            debug.exception("main", "cannot install preview hook", error);
            throw error;
        }

        // Keep the original 0.1.2 hook as an additional signal. If it is called,
        // augmentation still proceeds. If it is bypassed, probe.js will show the
        // actual Commando/DOM path that created the stock viewer.
        docs.preview = function(index, type) {
            serial++;
            var requestSerial = serial;
            var beforeBrowser = currentBrowser();

            debug.trace("main", "docs.preview() intercepted", {
                serial: requestSerial,
                index: index,
                type: type || "preview",
                subscope: currentSubscope(),
                browserBefore: !!beforeBrowser
            });

            var result;
            try {
                result = originalPreview.apply(docs, arguments);
            } catch (e) {
                debug.exception("main", "stock docs.preview() threw", e);
                throw e;
            }

            var browser = currentBrowser();
            debug.trace("main", "stock docs.preview() returned", {
                serial: requestSerial,
                returnValue: result === undefined ? "undefined" : String(result),
                browserAfter: !!browser,
                browserChanged: beforeBrowser !== browser
            });

            if (index !== undefined && index !== null && index !== "") {
                debug.trace("main", "scheduling Perl augmentation", {
                    serial: requestSerial,
                    index: index,
                    browserPresent: !!browser
                });
                augmenter.schedule(index, requestSerial, browser);
            } else {
                debug.trace("main", "not scheduling augmentation: empty index", {
                    serial: requestSerial,
                    index: index
                });
            }

            return result;
        };
        docs.preview.__komodoPerldoc = true;

        loaded = true;
        debug.trace("main", "0.1.3 hooks installed successfully", {
            wrappedPreviewType: typeof docs.preview,
            marker: !!docs.preview.__komodoPerldoc
        });
    };

    this.unload = function() {
        debug.trace("main", "unload() entered", {loaded: loaded});
        if (!loaded) return;

        try {
            probe.stop();
        } catch (e) {
            debug.exception("main", "failed to stop independent Commando probe", e);
        }

        if (docs.preview && docs.preview.__komodoPerldoc) {
            docs.preview = originalPreview;
            debug.trace("main", "stock docs.preview() restored");
        } else {
            debug.trace("main", "preview hook marker missing during unload; leaving current preview intact");
        }

        originalPreview = null;
        loaded = false;
        debug.trace("main", "unload() completed");
    };
}).apply(module.exports);
