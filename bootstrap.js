const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
Cu.import("resource://gre/modules/Services.jsm");

function loadIntoWindow(window) {
    if (!window || !window.require) return;

    var require = window.require;
    var log = require("ko/logging").getLogger("komodo-perldoc-bootstrap");

    try {
        // Do not depend on scope-docs having initialized before us.  Require
        // paths are cheap to register and this makes startup ordering irrelevant.
        require.setRequirePath("scope-docs/", "chrome://scope-docs/content/sdk/");
        require.setRequirePath("komodo-perldoc/", "chrome://komodo-perldoc/content/sdk/");
        require("komodo-perldoc/main").load();
    } catch (e) {
        log.exception(e, "Komodo Perldoc: failed to load");
    }
}

function unloadFromWindow(window) {
    if (!window || !window.require) return;

    var require = window.require;
    try {
        require.setRequirePath("scope-docs/", "chrome://scope-docs/content/sdk/");
        require.setRequirePath("komodo-perldoc/", "chrome://komodo-perldoc/content/sdk/");
        require("komodo-perldoc/main").unload();
    } catch (e) {
        // The window can already be half-destroyed during shutdown.
    }
}

var windowListener = {
    onOpenWindow: function(aWindow) {
        var domWindow = aWindow
            .QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);

        domWindow.addEventListener("komodo-post-startup", function onLoad() {
            domWindow.removeEventListener("komodo-post-startup", onLoad, false);
            loadIntoWindow(domWindow);
        }, false);
    },

    onCloseWindow: function(aWindow) {},
    onWindowTitleChange: function(aWindow, aTitle) {}
};

function startup(data, reason) {
    var windows = Services.wm.getEnumerator("Komodo");
    while (windows.hasMoreElements()) {
        var domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
        loadIntoWindow(domWindow);
    }

    Services.wm.addListener(windowListener);
}

function shutdown(data, reason) {
    if (reason == APP_SHUTDOWN) return;

    Services.wm.removeListener(windowListener);

    var windows = Services.wm.getEnumerator("Komodo");
    while (windows.hasMoreElements()) {
        var domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
        unloadFromWindow(domWindow);
    }
}

function install(data, reason) {}
function uninstall(data, reason) {}
