(function() {
    const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
    Cu.import("resource://gre/modules/Services.jsm");

    const VERSION = "0.1.9";
    const PREFIX = "[komodo-perldoc " + VERSION + "]";
    const SCOPE_DOCS_CONTRACT = "@activestate.com/commando/koScopeDocs;1";
    const RETRY_DELAY_MS = 100;
    const RETRY_LIMIT = 150;

    var traceInitialized = false;
    var postStartupSeen = false;

    function debugFile() {
        var file = Services.dirsvc.get("ProfD", Ci.nsIFile);
        file.append("komodo-perldoc-debug.log");
        return file;
    }

    function writeTrace(line, truncate) {
        try {
            var file = debugFile();
            var stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
            var flags = 0x02 | 0x08 | (truncate ? 0x20 : 0x10);
            stream.init(file, flags, 420, 0);
            var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
            converter.init(stream, "UTF-8", 0, 0);
            converter.writeString(line + "\n");
            converter.close();
        } catch (e) {
            try { Services.console.logStringMessage(PREFIX + " [overlay] trace-file write failed: " + e); } catch (ignored) {}
        }
    }

    function trace(message, details, truncate) {
        var now;
        try { now = new Date().toISOString(); } catch (e) { now = String(new Date()); }
        var line = now + " " + PREFIX + " [overlay] " + message;
        if (details !== undefined) {
            try { line += " | " + (typeof details == "string" ? details : JSON.stringify(details)); }
            catch (e) { line += " | " + String(details); }
        }
        try { Services.console.logStringMessage(line); } catch (e) {}
        writeTrace(line, !!truncate);
    }

    function scopeDocsReady() {
        try { return !!Cc[SCOPE_DOCS_CONTRACT]; }
        catch (e) { return false; }
    }

    function describeWindow() {
        var result = {hasRequire: !!window.require, href: null, readyState: null, postStartupSeen: postStartupSeen};
        try { result.href = window.location && window.location.href; } catch (e) {}
        try { result.readyState = document && document.readyState; } catch (e) {}
        return result;
    }

    function load(attempt) {
        attempt = attempt || 0;
        if (window.__komodoPerldocLoaded) return;

        if (!window.require || !scopeDocsReady()) {
            if (attempt >= RETRY_LIMIT) {
                trace("FAILED: Komodo/scope-docs dependencies did not become ready", {
                    attempt: attempt,
                    hasRequire: !!window.require,
                    scopeDocsReady: scopeDocsReady(),
                    contract: SCOPE_DOCS_CONTRACT
                });
                return;
            }

            if (attempt === 0 || attempt === 5 || attempt === 10 || attempt === 25 || attempt === 50 || attempt === 100) {
                trace("dependencies not ready; retrying", {
                    attempt: attempt,
                    hasRequire: !!window.require,
                    scopeDocsReady: scopeDocsReady(),
                    postStartupSeen: postStartupSeen
                });
            }
            window.setTimeout(function() { load(attempt + 1); }, RETRY_DELAY_MS);
            return;
        }

        try {
            window.require.setRequirePath("komodo-perldoc/", "chrome://komodo-perldoc/content/sdk/");
            trace("scope-docs component ready; requiring komodo-perldoc/main", {
                attempt: attempt,
                postStartupSeen: postStartupSeen
            });
            var main = window.require("komodo-perldoc/main");
            main.load();
            window.__komodoPerldocLoaded = true;
            trace("main.load() completed");
        } catch (e) {
            var text = "";
            try { text = e.name + ": " + e.message + (e.stack ? "\n" + e.stack : ""); }
            catch (ignored) { text = String(e); }
            trace("FAILED to load Komodo Perldoc", text);
        }
    }

    function initializeTrace() {
        if (traceInitialized) return;
        traceInitialized = true;
        trace("classic overlay loaded", describeWindow(), true);
    }

    initializeTrace();

    window.addEventListener("komodo-post-startup", function onPostStartup() {
        window.removeEventListener("komodo-post-startup", onPostStartup, false);
        postStartupSeen = true;
        trace("komodo-post-startup received", describeWindow());
        load(0);
    }, false);

    // The overlay normally loads before komodo-post-startup, but a first
    // dependency-driven attempt also covers late overlay injection safely.
    window.setTimeout(function() { load(0); }, 0);
})();
