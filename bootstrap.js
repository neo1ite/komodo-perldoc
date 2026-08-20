const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
Cu.import("resource://gre/modules/Services.jsm");

const VERSION = "0.1.3";
const PREFIX = "[komodo-perldoc " + VERSION + "]";

function debugFile() {
    var file = Services.dirsvc.get("ProfD", Ci.nsIFile);
    file.append("komodo-perldoc-debug.log");
    return file;
}

function writeTrace(line, truncate) {
    try {
        var file = debugFile();
        var stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
        var flags = 0x02 | 0x08 | (truncate ? 0x20 : 0x10); // write | create | truncate/append
        stream.init(file, flags, 420, 0); // 0644

        var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
        converter.init(stream, "UTF-8", 0, 0);
        converter.writeString(line + "\n");
        converter.close();
    } catch (e) {
        try {
            Services.console.logStringMessage(PREFIX + " [bootstrap] trace-file write failed: " + e);
        } catch (ignored) {}
    }
}

function trace(message, details, truncate) {
    var now;
    try { now = new Date().toISOString(); } catch (e) { now = String(new Date()); }

    var line = now + " " + PREFIX + " [bootstrap] " + message;
    if (details !== undefined) {
        try {
            line += " | " + (typeof details == "string" ? details : JSON.stringify(details));
        } catch (e) {
            line += " | " + String(details);
        }
    }

    try { Services.console.logStringMessage(line); } catch (e) {}
    writeTrace(line, !!truncate);
}

function describeWindow(window) {
    if (!window) return {window: false};

    var description = {
        window: true,
        hasRequire: !!window.require,
        href: null,
        readyState: null
    };

    try { description.href = window.location && window.location.href; } catch (e) {}
    try { description.readyState = window.document && window.document.readyState; } catch (e) {}
    return description;
}

function loadIntoWindow(window) {
    trace("loadIntoWindow() entered", describeWindow(window));

    if (!window) {
        trace("loadIntoWindow() aborted: no window");
        return;
    }
    if (!window.require) {
        trace("loadIntoWindow() aborted: window.require is not available", describeWindow(window));
        return;
    }

    var require = window.require;

    try {
        trace("registering CommonJS require paths");
        require.setRequirePath("scope-docs/", "chrome://scope-docs/content/sdk/");
        require.setRequirePath("komodo-perldoc/", "chrome://komodo-perldoc/content/sdk/");
        trace("require paths registered");

        var main = require("komodo-perldoc/main");
        trace("komodo-perldoc/main required", {hasLoad: !!(main && main.load)});
        main.load();
        trace("main.load() completed");
    } catch (e) {
        var text = "";
        try { text = e.name + ": " + e.message + (e.stack ? "\n" + e.stack : ""); } catch (ignored) { text = String(e); }
        trace("FAILED to load Komodo Perldoc", text);

        try {
            var log = require("ko/logging").getLogger("komodo-perldoc-bootstrap");
            log.exception(e, "Komodo Perldoc: failed to load");
        } catch (ignored) {}
    }
}

function unloadFromWindow(window) {
    trace("unloadFromWindow() entered", describeWindow(window));
    if (!window || !window.require) return;

    var require = window.require;
    try {
        require.setRequirePath("scope-docs/", "chrome://scope-docs/content/sdk/");
        require.setRequirePath("komodo-perldoc/", "chrome://komodo-perldoc/content/sdk/");
        require("komodo-perldoc/main").unload();
        trace("main.unload() completed");
    } catch (e) {
        trace("main.unload() failed", String(e));
    }
}

var windowListener = {
    onOpenWindow: function(aWindow) {
        trace("windowListener.onOpenWindow()");

        var domWindow;
        try {
            domWindow = aWindow
                .QueryInterface(Ci.nsIInterfaceRequestor)
                .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
        } catch (e) {
            trace("could not obtain DOM window", String(e));
            return;
        }

        trace("DOM window obtained; waiting for komodo-post-startup", describeWindow(domWindow));
        domWindow.addEventListener("komodo-post-startup", function onLoad() {
            domWindow.removeEventListener("komodo-post-startup", onLoad, false);
            trace("komodo-post-startup received", describeWindow(domWindow));
            loadIntoWindow(domWindow);
        }, false);
    },

    onCloseWindow: function(aWindow) {
        trace("windowListener.onCloseWindow()");
    },
    onWindowTitleChange: function(aWindow, aTitle) {}
};

function startup(data, reason) {
    trace("startup() entered", {
        reason: reason,
        installPath: data && data.installPath ? data.installPath.path : null,
        resourceURI: data && data.resourceURI ? data.resourceURI.spec : null
    }, true);

    var count = 0;
    var windows = Services.wm.getEnumerator("Komodo");
    while (windows.hasMoreElements()) {
        count++;
        var domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
        trace("loading into existing Komodo window #" + count, describeWindow(domWindow));
        loadIntoWindow(domWindow);
    }
    trace("existing Komodo windows enumerated", {count: count});

    Services.wm.addListener(windowListener);
    trace("window listener registered", {debugLog: debugFile().path});
}

function shutdown(data, reason) {
    trace("shutdown() entered", {reason: reason});
    if (reason == APP_SHUTDOWN) {
        trace("application shutdown; skipping explicit cleanup");
        return;
    }

    Services.wm.removeListener(windowListener);
    trace("window listener removed");

    var windows = Services.wm.getEnumerator("Komodo");
    while (windows.hasMoreElements()) {
        var domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
        unloadFromWindow(domWindow);
    }
}

function install(data, reason) {
    trace("install() called", {reason: reason});
}

function uninstall(data, reason) {
    trace("uninstall() called", {reason: reason});
}
