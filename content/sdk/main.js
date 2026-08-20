(function() {
    const debug   = require("./debug");
    const monitor = require("./monitor");

    var loaded = false;

    debug.trace("main", "module evaluated", {
        debugLog: debug.path()
    });

    this.load = function() {
        debug.trace("main", "load() entered", {alreadyLoaded: loaded});
        if (loaded) return;

        // 0.1.3 proved that normal Commando navigation bypasses the exported
        // scope-docs/docs.preview() function.  Do not monkey-patch scope-docs.
        // Observe the selected stock result and stock #doc-preview instead.
        monitor.start();

        loaded = true;
        debug.trace("main", "Komodo Perldoc 0.1.4 monitor started");
    };

    this.unload = function() {
        debug.trace("main", "unload() entered", {loaded: loaded});
        if (!loaded) return;

        try {
            monitor.stop();
        } catch (e) {
            debug.exception("main", "failed to stop monitor", e);
        }

        loaded = false;
        debug.trace("main", "unload() completed");
    };
}).apply(module.exports);
