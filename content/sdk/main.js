(function() {
    const docs    = require("scope-docs/docs");
    const debug   = require("./debug");
    const probe   = require("./probe");
    const monitor = require("./monitor");

    var loaded = false;

    debug.trace("main", "module evaluated", {
        hasDocs: !!docs,
        docsExports: Object.keys(docs).sort(),
        debugLog: debug.path()
    });

    this.load = function() {
        debug.trace("main", "load() entered", {alreadyLoaded: loaded});
        if (loaded) return;

        // 0.1.3 proved that scope-docs does not call the exported docs.preview()
        // during normal Commando navigation.  0.1.4 therefore stops wrapping it
        // completely and drives augmentation from the observed selected result
        // plus the stock #doc-preview browser that Komodo actually creates.
        monitor.start();
        debug.trace("main", "production Commando monitor started");

        // Keep the detailed probe for this test build so the production path and
        // the observed Komodo state can be compared in one trace file.
        try {
            probe.start();
            debug.trace("main", "independent diagnostic probe started");
        } catch (e) {
            debug.exception("main", "failed to start diagnostic probe", e);
        }

        loaded = true;
        debug.trace("main", "Komodo Perldoc 0.1.4 loaded without scope-docs function wrapping");
    };

    this.unload = function() {
        debug.trace("main", "unload() entered", {loaded: loaded});
        if (!loaded) return;

        try { monitor.stop(); } catch (e) { debug.exception("main", "failed to stop monitor", e); }
        try { probe.stop(); } catch (e) { debug.exception("main", "failed to stop probe", e); }

        loaded = false;
        debug.trace("main", "unload() completed");
    };
}).apply(module.exports);
