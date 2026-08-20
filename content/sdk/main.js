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

        // Normal Commando navigation bypasses scope-docs/docs.preview().
        // Observe the selected stock result and stock #doc-preview instead of
        // monkey-patching the scope implementation.
        monitor.start();

        loaded = true;
        debug.trace("main", "Komodo Perldoc 0.1.7 monitor started");
    };

    this.unload = function() {
        debug.trace("main", "unload() entered", {loaded: loaded});
        if (!loaded) return;

        try { monitor.stop(); }
        catch (e) { debug.exception("main", "failed to stop monitor", e); }

        loaded = false;
        debug.trace("main", "unload() completed");
    };
}).apply(module.exports);
