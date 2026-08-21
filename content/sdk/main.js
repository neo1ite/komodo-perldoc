(function() {
    const debug   = require("./debug");
    const compat  = require("./compat");
    const monitor = require("./monitor");

    var loaded = false;

    debug.trace("main", "module evaluated", {
        debugLog: debug.path()
    });

    this.load = function() {
        debug.trace("main", "load() entered", {alreadyLoaded: loaded});
        if (loaded) return;

        // Komodo 9.3 does not refresh Documentation preview after a plain mouse
        // selection; keep that compatibility fix isolated here.
        compat.start();

        // Normal Commando navigation bypasses scope-docs/docs.preview().
        // Observe the selected stock result and stock #doc-preview instead of
        // monkey-patching the scope implementation. The broken synthetic Perl
        // root breadcrumb is handled directly by the monitor while the current
        // Perl subscope is still active.
        monitor.start();

        loaded = true;
        debug.trace("main", "Komodo Perldoc 0.1.10 monitor started");
    };

    this.unload = function() {
        debug.trace("main", "unload() entered", {loaded: loaded});
        if (!loaded) return;

        try { monitor.stop(); }
        catch (e) { debug.exception("main", "failed to stop monitor", e); }

        try { compat.stop(); }
        catch (e) { debug.exception("main", "failed to stop compatibility fixes", e); }

        loaded = false;
        debug.trace("main", "unload() completed");
    };
}).apply(module.exports);
