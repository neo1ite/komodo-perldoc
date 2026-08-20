(function() {
    const debug    = require("./debug");
    const $        = require("ko/dom");
    const commando = require("commando/commando");
    const docs     = require("scope-docs/docs");
    const _window  = require("ko/windows").getMain();
    const timers   = require("sdk/timers");

    var started = false;
    var observer = null;
    var pollTimer = null;
    var lastState = "";
    var eventBindings = [];

    function sample(value, limit) {
        if (value === undefined || value === null) return value;
        value = String(value).replace(/\s+/g, " ").trim();
        limit = limit || 600;
        return value.length > limit ? value.substr(0, limit) + "…" : value;
    }

    function moduleShape(object) {
        var result = {};
        var keys = [];
        try { keys = Object.keys(object).sort(); } catch (e) {}
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value;
            try { value = object[key]; } catch (e) { value = "<throws>"; }
            result[key] = typeof value;
        }
        return result;
    }

    function currentBrowser() {
        var browser = $("#doc-preview", _window);
        return browser.length ? browser.element() : null;
    }

    function selectedResultSnapshot() {
        var result = {subscope: null, scope: null, search: null, selectedText: null, selectedAttrs: {}};
        try { result.subscope = commando.getSubscope(); } catch (e) { result.subscope = "<error: " + e + ">"; }
        try { result.scope = commando.getScope(); } catch (e) { result.scope = "<error: " + e + ">"; }
        try { result.search = commando.getSearchValue(); } catch (e) {}

        try {
            var selected = $("#commando-results richlistitem[selected='true']", _window);
            if (!selected.length) selected = $("#commando-results [selected='true']", _window);
            if (selected.length) {
                var elem = selected.element();
                result.selectedText = sample(elem.textContent, 300);
                var names = ["id", "value", "data-index", "index", "selected", "class"];
                for (var i = 0; i < names.length; i++) {
                    var name = names[i];
                    try {
                        if (elem.hasAttribute && elem.hasAttribute(name)) result.selectedAttrs[name] = elem.getAttribute(name);
                    } catch (e) {}
                }
            }
        } catch (e) {
            result.selectedText = "<selection probe failed: " + e + ">";
        }
        return result;
    }

    function inspectPreview(reason) {
        var browser = currentBrowser();
        var data = {
            reason: reason,
            hasBrowser: !!browser,
            browserSrc: null,
            href: null,
            readyState: null,
            wrapperText: null,
            heading: null,
            links: []
        };

        if (browser) {
            try { data.browserSrc = browser.getAttribute("src"); } catch (e) {}
            try {
                var w = browser.contentWindow;
                data.href = w && w.location ? String(w.location.href) : null;
                data.readyState = w && w.document ? w.document.readyState : null;
                if (w && w.document) {
                    var wrapper = w.document.getElementById("wrapper");
                    data.wrapperText = wrapper ? sample(wrapper.textContent, 900) : null;
                    var h = wrapper && wrapper.querySelector ? wrapper.querySelector("h1, h2") : null;
                    data.heading = h ? sample(h.textContent, 200) : null;
                    var anchors = wrapper && wrapper.querySelectorAll ? wrapper.querySelectorAll("a") : [];
                    for (var i = 0; i < anchors.length && i < 30; i++) {
                        var a = anchors[i];
                        data.links.push({
                            text: sample(a.textContent, 120),
                            index: a.getAttribute("index"),
                            linkIndex: a.getAttribute("link-index"),
                            href: a.getAttribute("href"),
                            className: a.getAttribute("class")
                        });
                    }
                }
            } catch (e) {
                data.previewError = String(e);
            }
        }

        debug.trace("probe", "Documentation preview snapshot", data);
    }

    function bind(selector, eventName) {
        var target = $(selector, _window);
        if (!target.length) {
            debug.trace("probe", "event target not found", {selector: selector, event: eventName});
            return;
        }

        var handler = function(event) {
            var original = event && event.originalEvent ? event.originalEvent : event;
            var targetElem = original && original.target ? original.target : null;
            debug.trace("probe", "Commando DOM event", {
                selector: selector,
                event: eventName,
                target: targetElem ? targetElem.localName : null,
                targetId: targetElem ? targetElem.id : null,
                targetClass: targetElem && targetElem.getAttribute ? targetElem.getAttribute("class") : null,
                targetText: targetElem ? sample(targetElem.textContent, 220) : null,
                state: selectedResultSnapshot()
            });
            timers.setTimeout(function() { inspectPreview("after " + eventName); }, 0);
            timers.setTimeout(function() { inspectPreview("after " + eventName + " +100ms"); }, 100);
        };

        target.on(eventName, handler);
        eventBindings.push({target: target, eventName: eventName, handler: handler});
    }

    function installObserver() {
        var preview = $("#commando-preview", _window);
        if (!preview.length) {
            debug.trace("probe", "#commando-preview not found; MutationObserver not installed");
            return;
        }

        try {
            observer = new _window.MutationObserver(function(records) {
                var summary = [];
                for (var i = 0; i < records.length && i < 20; i++) {
                    var record = records[i];
                    summary.push({
                        type: record.type,
                        target: record.target && record.target.localName,
                        targetId: record.target && record.target.id,
                        added: record.addedNodes ? record.addedNodes.length : 0,
                        removed: record.removedNodes ? record.removedNodes.length : 0,
                        attributeName: record.attributeName || null
                    });
                }
                debug.trace("probe", "#commando-preview mutation", {records: summary});
                timers.setTimeout(function() { inspectPreview("mutation"); }, 0);
                timers.setTimeout(function() { inspectPreview("mutation +50ms"); }, 50);
            });
            observer.observe(preview.element(), {childList: true, subtree: true, attributes: true});
            debug.trace("probe", "MutationObserver installed on #commando-preview");
        } catch (e) {
            debug.exception("probe", "failed to install MutationObserver", e);
        }
    }

    function poll() {
        if (!started) return;
        var snapshot = selectedResultSnapshot();
        var browser = currentBrowser();
        snapshot.hasDocPreview = !!browser;
        try { snapshot.docPreviewSrc = browser ? browser.getAttribute("src") : null; } catch (e) {}

        var serialized = "";
        try { serialized = JSON.stringify(snapshot); } catch (e) { serialized = String(snapshot); }
        if (serialized != lastState) {
            lastState = serialized;
            debug.trace("probe", "Commando state changed", snapshot);
            inspectPreview("state change");
        }
        pollTimer = timers.setTimeout(poll, 250);
    }

    this.start = function() {
        if (started) return;
        started = true;

        debug.trace("probe", "starting independent diagnostics", {
            docsExports: moduleShape(docs),
            commandoExports: moduleShape(commando)
        });

        bind("#commando-results", "click");
        bind("#commando-results", "command");
        bind("#commando-results", "dblclick");
        bind("#commando-results", "keydown");
        bind("#commando-subscope-wrap", "command");
        bind("#commando-panel", "popupshown");
        bind("#commando-panel", "popuphidden");
        installObserver();
        inspectPreview("probe start");
        poll();
    };

    this.stop = function() {
        if (!started) return;
        started = false;
        if (pollTimer) timers.clearTimeout(pollTimer);
        pollTimer = null;
        if (observer) {
            try { observer.disconnect(); } catch (e) {}
            observer = null;
        }
        for (var i = 0; i < eventBindings.length; i++) {
            try { eventBindings[i].target.off(eventBindings[i].eventName, eventBindings[i].handler); } catch (e) {}
        }
        eventBindings = [];
        debug.trace("probe", "independent diagnostics stopped");
    };
}).apply(module.exports);
