(function() {
    const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
    Cu.import("resource://gre/modules/Services.jsm");

    const VERSION = "0.2.0";
    const PREFIX = "[komodo-perldoc " + VERSION + "]";
    const SCOPE_DOCS_CONTRACT = "@activestate.com/commando/koScopeDocs;1";
    const RETRY_BASE_DELAY_MS = 100;
    const RETRY_MAX_DELAY_MS = 1000;
    const RETRY_LIMIT = 24;

    var traceInitialized = false;
    var postStartupSeen = false;
    var retryTimer = null;
    var retryAttempt = 0;

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

    function retryDelay(attempt) {
        var exponent = Math.min(attempt, 4);
        return Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * Math.pow(2, exponent));
    }

    function clearRetryTimer() {
        if (retryTimer !== null) {
            window.clearTimeout(retryTimer);
            retryTimer = null;
        }
    }

    function scheduleRetry() {
        if (window.__komodoPerldocLoaded || retryTimer !== null) return;
        if (retryAttempt >= RETRY_LIMIT) {
            trace("FAILED: Komodo/scope-docs dependencies did not become ready", {
                attempt: retryAttempt,
                hasRequire: !!window.require,
                scopeDocsReady: scopeDocsReady(),
                contract: SCOPE_DOCS_CONTRACT
            });
            return;
        }

        var attempt = retryAttempt++;
        if (attempt === 0 || attempt === 3 || attempt === 7 || attempt === 15 || attempt === RETRY_LIMIT - 1) {
            trace("dependencies not ready; retrying", {
                attempt: attempt,
                delayMs: retryDelay(attempt),
                hasRequire: !!window.require,
                scopeDocsReady: scopeDocsReady(),
                postStartupSeen: postStartupSeen
            });
        }

        retryTimer = window.setTimeout(function() {
            retryTimer = null;
            load();
        }, retryDelay(attempt));
    }

    function load() {
        if (window.__komodoPerldocLoaded) {
            clearRetryTimer();
            return;
        }

        if (!window.require || !scopeDocsReady()) {
            scheduleRetry();
            return;
        }

        clearRetryTimer();
        try {
            window.require.setRequirePath("komodo-perldoc/", "chrome://komodo-perldoc/content/sdk/");
            trace("scope-docs component ready; requiring komodo-perldoc/main", {
                attempt: retryAttempt,
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

    function kickLoad() {
        /* The classic overlay and komodo-post-startup can race. Keep exactly
         * one startup chain: cancel a pending backoff before an immediate kick. */
        clearRetryTimer();
        load();
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
        kickLoad();
    }, false);

    /* The overlay normally arrives before komodo-post-startup. This zero-delay
     * fallback covers late injection, but like 0.1.11 it shares one retry
     * timer with the event-driven path and therefore cannot create two 100 ms
     * polling chains. */
    retryTimer = window.setTimeout(function() {
        retryTimer = null;
        load();
    }, 0);
})();
