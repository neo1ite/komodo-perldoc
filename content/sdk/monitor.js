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
    var debounceTimer = null;
    var retryTimers = [];
    var burstGeneration = 0;
    var serial = 0;
    var browserSeq = 0;
    var documentSeq = 0;
    var observedDocument = null;
    var observedDocumentId = 0;
    var lastKey = null;
    var lastMismatchKey = null;
    var eventBindings = [];
    var browserLoadTarget = null;
    var browserLoadHandler = null;
    var rootGuardDocument = null;
    var rootGuardClickHandler = null;
    var rootGuardKeyHandler = null;
    var rootRedirectPending = false;

    // Commando renders Documentation asynchronously.  A short, bounded retry
    // burst covers selection -> browser creation -> stock render without the
    // permanent 250 ms poll used by 0.1.4.
    var RETRY_DELAYS = [0, 75, 175, 350, 700, 1400];

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

    function documentId(browser) {
        try {
            var doc = browser && browser.contentDocument;
            if (!doc) return null;
            if (doc !== observedDocument) {
                observedDocument = doc;
                observedDocumentId = ++documentSeq;
            }
            return observedDocumentId;
        } catch (e) {
            return null;
        }
    }

    function browserSrc(browser) {
        try { return browser ? browser.getAttribute("src") : null; }
        catch (e) { return null; }
    }

    function stockMarkupSample(browser) {
        try {
            var doc = browser && browser.contentDocument;
            var wrapper = doc && doc.getElementById("wrapper");
            var html = wrapper && wrapper.innerHTML ? String(wrapper.innerHTML) : "";
            return html.length > 1800 ? html.substr(0, 1800) + "…" : html;
        } catch (e) {
            return "<unavailable: " + e + ">";
        }
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

    function clearRetryTimers() {
        for (var i = 0; i < retryTimers.length; i++) {
            try { timers.clearTimeout(retryTimers[i]); } catch (e) {}
        }
        retryTimers = [];
    }

    function detachRootNavigationGuard() {
        if (rootGuardDocument) {
            if (rootGuardClickHandler) {
                try { rootGuardDocument.removeEventListener("click", rootGuardClickHandler, true); } catch (e) {}
            }
            if (rootGuardKeyHandler) {
                try { rootGuardDocument.removeEventListener("keydown", rootGuardKeyHandler, true); } catch (e) {}
                try { rootGuardDocument.removeEventListener("keypress", rootGuardKeyHandler, true); } catch (e) {}
            }
        }
        rootGuardDocument = null;
        rootGuardClickHandler = null;
        rootGuardKeyHandler = null;
        rootRedirectPending = false;
    }

    function perlRootLink(doc) {
        try {
            var link = doc && doc.querySelector && doc.querySelector("#wrapper a[index='0']");
            if (!link) return null;
            var text = String(link.textContent || "").replace(/\s+/g, " ").trim();
            return text == "Perl" ? link : null;
        } catch (e) {
            return null;
        }
    }

    function indexedAncestor(node, doc) {
        var wrapper = null;
        try { wrapper = doc && doc.getElementById("wrapper"); } catch (e) {}
        while (node && node !== doc) {
            if (node === wrapper) break;
            try {
                if (node.getAttribute && node.getAttribute("index") !== null) return node;
            } catch (e) {}
            node = node.parentNode;
        }
        return null;
    }

    function stopNavigationEvent(event) {
        try { event.preventDefault(); } catch (e) {}
        try { event.stopPropagation(); } catch (e) {}
        try { event.stopImmediatePropagation(); } catch (e) {}
    }

    function showPerlRoot(reason, doc) {
        if (rootRedirectPending) return;
        rootRedirectPending = true;

        debug.trace("monitor", "intercepted invalid scope-docs Perl root index; returning to Perl subscope", {
            reason: reason,
            rootIndex: 0,
            rootResultId: "docs-Perl"
        });

        timers.setTimeout(function() {
            try {
                if (typeof commando.showSubscope == "function") {
                    // koScopeDocs exposes Perl as the synthetic scope result
                    // `docs-Perl`; its breadcrumb index=0 is not a DB entry.
                    commando.showSubscope("scope-docs", "docs-Perl");
                } else {
                    // Defensive fallback for older Commando implementations.
                    commando.show("scope-docs");
                }
                debug.trace("monitor", "Perl root redirect dispatched", {
                    via: typeof commando.showSubscope == "function" ? "showSubscope" : "show"
                });
            } catch (e) {
                debug.exception("monitor", "failed to return to Perl documentation root", e);
            }

            timers.setTimeout(function() {
                rootRedirectPending = false;
            }, 250);
        }, 0);
    }

    function installRootNavigationGuard(browser) {
        var doc = null;
        try { doc = browser && browser.contentDocument; } catch (e) {}
        if (!doc || doc === rootGuardDocument) return;

        detachRootNavigationGuard();
        rootGuardDocument = doc;

        rootGuardClickHandler = function(event) {
            if (!started || !isPerlDocs() || !perlRootLink(doc)) return;

            var indexed = indexedAncestor(event.target, doc);
            if (!indexed) return;

            var index = null;
            try { index = indexed.getAttribute("index"); } catch (e) {}
            if (String(index) != "0") return;

            stopNavigationEvent(event);
            showPerlRoot("click", doc);
        };

        rootGuardKeyHandler = function(event) {
            if (!started || !isPerlDocs() || !perlRootLink(doc)) return;
            if (event.ctrlKey || event.altKey || event.metaKey) return;

            var key = "";
            var code = 0;
            try { key = event.key || ""; } catch (e) {}
            try { code = event.which || event.keyCode || event.charCode || 0; } catch (e) {}
            if (key != "1" && code != 49 && code != 97) return;

            var shortcut = null;
            try { shortcut = doc.querySelector("#wrapper .link-key[link-index='1'][index='0']"); } catch (e) {}
            if (!shortcut) return;

            stopNavigationEvent(event);
            showPerlRoot("keyboard shortcut 1", doc);
        };

        try {
            doc.addEventListener("click", rootGuardClickHandler, true);
            doc.addEventListener("keydown", rootGuardKeyHandler, true);
            doc.addEventListener("keypress", rootGuardKeyHandler, true);
            debug.trace("monitor", "installed guard for synthetic Perl root breadcrumb", {
                browserId: browserId(browser),
                documentId: documentId(browser),
                browserSrc: browserSrc(browser),
                rootPresent: !!perlRootLink(doc)
            });
        } catch (e) {
            debug.exception("monitor", "could not install Perl root navigation guard", e);
            detachRootNavigationGuard();
        }
    }

    function detachBrowserLoad() {
        if (browserLoadTarget && browserLoadHandler) {
            try { browserLoadTarget.removeEventListener("load", browserLoadHandler, true); } catch (e) {}
        }
        browserLoadTarget = null;
        browserLoadHandler = null;
        detachRootNavigationGuard();
    }

    function refreshBrowserLoadBinding() {
        var browser = currentBrowser();
        if (browser === browserLoadTarget) return;

        detachBrowserLoad();
        if (!browser) return;

        browserLoadTarget = browser;
        browserLoadHandler = function() {
            installRootNavigationGuard(browser);
            scheduleBurst("documentation browser load", 20);
        };

        try {
            browser.addEventListener("load", browserLoadHandler, true);
            installRootNavigationGuard(browser);
            debug.trace("monitor", "observing Documentation browser load lifecycle", {
                browserId: browserId(browser),
                browserSrc: browserSrc(browser)
            });
        } catch (e) {
            debug.exception("monitor", "could not observe Documentation browser load lifecycle", e);
            detachBrowserLoad();
        }
    }

    function run(reason, attempt, generation) {
        if (!started || generation != burstGeneration) return;
        if (!isPerlDocs()) {
            lastMismatchKey = null;
            return;
        }

        var selected = selectedEntry();
        var browser = currentBrowser();
        if (!selected || !browser || !pageReady(browser)) return;

        installRootNavigationGuard(browser);

        var heading = pageHeading(browser);
        var bid = browserId(browser);
        var did = documentId(browser);
        var src = browserSrc(browser);

        // A maximized scope-docs viewer keeps the original Commando result
        // selected while its own breadcrumbs navigate to another page.  Treat
        // that as stock viewer navigation, not as a new augmentation target.
        if (selected.name && heading && selected.name != heading) {
            var mismatchKey = [selected.index, bid, did, heading].join("|");
            if (mismatchKey != lastMismatchKey) {
                lastMismatchKey = mismatchKey;
                debug.trace("monitor", "stock Documentation navigated away from selected symbol; augmentation suspended", {
                    reason: reason,
                    attempt: attempt,
                    index: selected.index,
                    selectedName: selected.name,
                    heading: heading,
                    browserId: bid,
                    documentId: did,
                    browserSrc: src,
                    stockMarkupSample: stockMarkupSample(browser)
                });
            }
            return;
        }

        lastMismatchKey = null;

        // Include the document identity.  The same <browser> element may load a
        // fresh stock document with the same src/heading after Commando is
        // reopened; that new document still needs augmentation.
        var key = [selected.index, bid, did, heading].join("|");
        if (key == lastKey) return;
        lastKey = key;
        serial++;

        debug.trace("monitor", "scheduling augmentation from observed Commando state", {
            reason: reason,
            attempt: attempt,
            serial: serial,
            index: selected.index,
            selectedId: selected.id,
            selectedName: selected.name,
            selectedText: selected.text,
            browserId: bid,
            documentId: did,
            browserSrc: src,
            heading: heading
        });

        augmenter.schedule(selected.index, serial, browser);
    }

    function beginBurst(reason) {
        if (!started) return;

        clearRetryTimers();
        refreshBrowserLoadBinding();

        var generation = ++burstGeneration;
        for (var i = 0; i < RETRY_DELAYS.length; i++) {
            (function(attempt, delay) {
                var timer = timers.setTimeout(function() {
                    run(reason, attempt, generation);
                }, delay);
                retryTimers.push(timer);
            })(i, RETRY_DELAYS[i]);
        }
    }

    function scheduleBurst(reason, delay) {
        if (!started) return;
        if (debounceTimer) timers.clearTimeout(debounceTimer);
        debounceTimer = timers.setTimeout(function() {
            debounceTimer = null;
            beginBurst(reason);
        }, delay === undefined ? 40 : delay);
    }

    function bind(selector, eventName) {
        var target = $(selector, _window);
        if (!target.length) return;
        var handler = function() { scheduleBurst(eventName, 35); };
        target.on(eventName, handler);
        eventBindings.push({target: target, eventName: eventName, handler: handler});
    }

    function installObservers() {
        var preview = $("#commando-preview", _window);
        if (preview.length) {
            previewObserver = new _window.MutationObserver(function() {
                refreshBrowserLoadBinding();
                scheduleBurst("preview mutation", 45);
            });
            previewObserver.observe(preview.element(), {childList: true, subtree: true, attributes: true});
        }

        var results = $("#commando-results", _window);
        if (results.length) {
            resultsObserver = new _window.MutationObserver(function() {
                scheduleBurst("result selection mutation", 35);
            });
            resultsObserver.observe(results.element(), {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["selected"]
            });
        }
    }

    this.start = function() {
        if (started) return;
        started = true;
        debug.trace("monitor", "starting event-driven Commando monitor", {
            retryDelays: RETRY_DELAYS
        });

        bind("#commando-results", "click");
        bind("#commando-results", "command");
        bind("#commando-results", "keydown");
        bind("#commando-subscope-wrap", "command");
        bind("#commando-panel", "popupshown");
        installObservers();
        refreshBrowserLoadBinding();
        scheduleBurst("monitor start", 0);
    };

    this.stop = function() {
        if (!started) return;
        started = false;
        burstGeneration++;

        if (debounceTimer) timers.clearTimeout(debounceTimer);
        debounceTimer = null;
        clearRetryTimers();
        detachBrowserLoad();

        if (previewObserver) previewObserver.disconnect();
        if (resultsObserver) resultsObserver.disconnect();
        previewObserver = null;
        resultsObserver = null;

        for (var i = 0; i < eventBindings.length; i++) {
            try { eventBindings[i].target.off(eventBindings[i].eventName, eventBindings[i].handler); } catch (e) {}
        }
        eventBindings = [];
        observedDocument = null;
        observedDocumentId = 0;
        lastKey = null;
        lastMismatchKey = null;
        debug.trace("monitor", "event-driven Commando monitor stopped");
    };
}).apply(module.exports);
