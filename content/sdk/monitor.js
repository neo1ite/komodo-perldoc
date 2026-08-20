(function() {
    const debug     = require("./debug");
    const $         = require("ko/dom");
    const commando  = require("commando/commando");
    const augmenter = require("./viewer");
    const _window   = require("ko/windows").getMain();
    const timers    = require("sdk/timers");

    var started = false;
    var previewObserver = null;
    var resultsObserver = null;
    var pollTimer = null;
    var debounceTimer = null;
    var serial = 0;
    var browserSeq = 0;
    var lastKey = null;
    var eventBindings = [];

    function currentBrowser() {
        var browser = $("#doc-preview", _window);
        return browser.length ? browser.element() : null;
    }

    function browserId(browser) {
        if (!browser) return null;
        if (!browser.__komodoPerldocMonitorId) {
            browser.__komodoPerldocMonitorId = ++browserSeq;
        }
        return browser.__komodoPerldocMonitorId;
    }

    function isPerlDocs() {
        try {
            var scope = commando.getScope();
            var subscope = commando.getSubscope();
            return !!(scope && scope.id == "scope-docs" && subscope && subscope.name == "Perl");
        } catch (e) {
            return false;
        }
    }

    function selectedEntry() {
        var selected = $("#commando-results richlistitem[selected='true']", _window);
        if (!selected.length) selected = $("#commando-results [selected='true']", _window);
        if (!selected.length) return null;

        var elem = selected.element();
        var id = elem && elem.id ? String(elem.id) : "";
        var match = /^co-result-item-doc-(\d+)$/.exec(id);
        if (!match) return null;

        var text = elem.textContent ? String(elem.textContent).replace(/\s+/g, " ").trim() : "";
        var nameMatch = /^\d+\s+([^\s]+)/.exec(text);

        return {
            index: match[1],
            id: id,
            name: nameMatch ? nameMatch[1] : null,
            text: text
        };
    }

    function pageHeading(browser) {
        try {
            var w = browser && browser.contentWindow;
            var wrapper = w && w.document && w.document.getElementById("wrapper");
            var heading = wrapper && wrapper.querySelector && wrapper.querySelector("h1, h2");
            return heading ? String(heading.textContent || "").replace(/^\s+|\s+$/g, "") : "";
        } catch (e) {
            return "";
        }
    }

    function pageReady(browser) {
        try {
            return !!(browser && browser.contentDocument && browser.contentDocument.readyState == "complete" &&
                      browser.contentWindow && browser.contentWindow.document &&
                      browser.contentWindow.document.getElementById("wrapper"));
        } catch (e) {
            return false;
        }
    }

    function run(reason) {
        debounceTimer = null;
        if (!started || !isPerlDocs()) return;

        var selected = selectedEntry();
        var browser = currentBrowser();
        if (!selected || !browser || !pageReady(browser)) return;

        var heading = pageHeading(browser);

        // When the user follows a breadcrumb/link in the maximized viewer,
        // Commando keeps the original search result selected.  Only attach
        // perldoc when the stock page still represents that selected symbol.
        if (selected.name && heading && selected.name != heading) {
            debug.trace("monitor", "not augmenting: rendered heading differs from selected symbol", {
                reason: reason,
                index: selected.index,
                selectedName: selected.name,
                heading: heading,
                browserSrc: browser.getAttribute("src")
            });
            return;
        }

        var key = [selected.index, browserId(browser), heading].join("|");
        if (key == lastKey) return;
        lastKey = key;
        serial++;

        debug.trace("monitor", "scheduling augmentation from observed Commando state", {
            reason: reason,
            serial: serial,
            index: selected.index,
            selectedId: selected.id,
            selectedName: selected.name,
            selectedText: selected.text,
            browserId: browserId(browser),
            browserSrc: browser.getAttribute("src"),
            heading: heading
        });

        augmenter.schedule(selected.index, serial, browser);
    }

    function schedule(reason, delay) {
        if (!started) return;
        if (debounceTimer) timers.clearTimeout(debounceTimer);
        debounceTimer = timers.setTimeout(function() { run(reason); }, delay === undefined ? 60 : delay);
    }

    function bind(selector, eventName) {
        var target = $(selector, _window);
        if (!target.length) return;
        var handler = function() { schedule(eventName, 50); };
        target.on(eventName, handler);
        eventBindings.push({target: target, eventName: eventName, handler: handler});
    }

    function installObservers() {
        var preview = $("#commando-preview", _window);
        if (preview.length) {
            previewObserver = new _window.MutationObserver(function() {
                schedule("preview mutation", 70);
            });
            previewObserver.observe(preview.element(), {childList: true, subtree: true, attributes: true});
        }

        var results = $("#commando-results", _window);
        if (results.length) {
            resultsObserver = new _window.MutationObserver(function() {
                schedule("result selection mutation", 50);
            });
            resultsObserver.observe(results.element(), {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["selected"]
            });
        }
    }

    function poll() {
        if (!started) return;
        schedule("poll", 0);
        pollTimer = timers.setTimeout(poll, 250);
    }

    this.start = function() {
        if (started) return;
        started = true;
        debug.trace("monitor", "starting production Commando monitor");

        bind("#commando-results", "click");
        bind("#commando-results", "command");
        bind("#commando-results", "keydown");
        bind("#commando-subscope-wrap", "command");
        bind("#commando-panel", "popupshown");
        installObservers();
        poll();
    };

    this.stop = function() {
        if (!started) return;
        started = false;

        if (pollTimer) timers.clearTimeout(pollTimer);
        if (debounceTimer) timers.clearTimeout(debounceTimer);
        pollTimer = null;
        debounceTimer = null;

        if (previewObserver) previewObserver.disconnect();
        if (resultsObserver) resultsObserver.disconnect();
        previewObserver = null;
        resultsObserver = null;

        for (var i = 0; i < eventBindings.length; i++) {
            try { eventBindings[i].target.off(eventBindings[i].eventName, eventBindings[i].handler); } catch (e) {}
        }
        eventBindings = [];
        lastKey = null;
        debug.trace("monitor", "production Commando monitor stopped");
    };
}).apply(module.exports);
