(function() {
    const $        = require("ko/dom");
    const {Cc, Ci} = require("chrome");
    const timers   = require("sdk/timers");
    const perldoc  = require("./perldoc");
    const debug    = require("./debug");

    const SCOPE_DOCS_CONTRACT = "@activestate.com/commando/koScopeDocs;1";
    const _window = require("ko/windows").getMain();

    var lastSerial = 0;

    debug.trace("viewer", "module evaluated", {
        hasWindow: !!_window,
        scopeContractPresent: !!Cc[SCOPE_DOCS_CONTRACT]
    });

    function scopeService() {
        try {
            var factory = Cc[SCOPE_DOCS_CONTRACT];
            if (!factory) return null;
            return factory.getService(Ci.koIScopeDocs);
        } catch (e) {
            debug.exception("viewer", "failed to obtain koScopeDocs service", e);
            return null;
        }
    }

    function currentBrowser() {
        var preview = $("#doc-preview", _window);
        if (!preview.length) return null;
        return preview.element();
    }

    function describeBrowser(browser) {
        if (!browser) return {present: false};
        var result = {present: true, src: null, readyState: null};
        try { result.src = browser.getAttribute("src"); } catch (e) {}
        try { result.readyState = browser.contentDocument && browser.contentDocument.readyState; } catch (e) {}
        return result;
    }

    function decodeInfo(first, second) {
        var raw = null;
        if (typeof second == "string" && second) raw = second;
        else if (typeof first == "string" && first) raw = first;

        debug.trace("viewer", "scope.info() payload inspected", {
            firstType: typeof first,
            secondType: typeof second,
            firstLength: typeof first == "string" ? first.length : null,
            secondLength: typeof second == "string" ? second.length : null,
            chosenLength: raw ? raw.length : 0
        });

        if (!raw) return null;
        return JSON.parse(raw);
    }

    function pageHeading(viewWindow) {
        try {
            var wrapper = viewWindow.document.getElementById("wrapper");
            var heading = wrapper && wrapper.querySelector && wrapper.querySelector("h1, h2");
            return heading ? String(heading.textContent || "").replace(/^\s+|\s+$/g, "") : "";
        } catch (e) {
            return "";
        }
    }

    function renderSection(viewWindow, title, body) {
        var wrapper = viewWindow.document.getElementById("wrapper");
        if (!wrapper) return false;

        var section = viewWindow.document.getElementById("komodo-perldoc");
        if (!section) {
            section = viewWindow.document.createElement("section");
            section.id = "komodo-perldoc";
            wrapper.appendChild(section);
            debug.trace("viewer", "created #komodo-perldoc section", {title: title});
        }

        while (section.firstChild) section.removeChild(section.firstChild);

        var heading = viewWindow.document.createElement("h2");
        heading.textContent = "Perldoc" + (title ? " — " + title : "");
        section.appendChild(heading);

        var pre = viewWindow.document.createElement("pre");
        pre.id = "komodo-perldoc-output";
        pre.style.whiteSpace = "pre-wrap";
        pre.style.wordWrap = "break-word";
        pre.textContent = body || "";
        section.appendChild(pre);

        debug.trace("viewer", "Perldoc section rendered", {
            title: title,
            bodyLength: body ? body.length : 0
        });
        return true;
    }

    function removeSection(viewWindow, reason) {
        try {
            var section = viewWindow.document.getElementById("komodo-perldoc");
            if (section && section.parentNode) section.parentNode.removeChild(section);
            debug.trace("viewer", "Perldoc section removed", {reason: reason || "unspecified"});
        } catch (e) {
            debug.exception("viewer", "failed to remove Perldoc section", e);
        }
    }

    function stillShowing(viewWindow) {
        var browser = currentBrowser();
        return !!(browser && browser.contentWindow === viewWindow);
    }

    function waitForStockRender(data, serial, browser, callback, attempt) {
        attempt = attempt || 0;
        if (serial != lastSerial) return;

        var current = currentBrowser();
        if (!browser) browser = current;
        if (!browser || current !== browser) return;

        var viewWindow = browser.contentWindow;
        var wrapper = viewWindow && viewWindow.document && viewWindow.document.getElementById("wrapper");
        var heading = viewWindow ? pageHeading(viewWindow) : "";
        var ready = !!(wrapper && wrapper.firstChild && heading == data.name);

        if (!ready) {
            if (attempt === 0 || attempt === 5 || attempt === 10 || attempt === 20 || attempt === 40 || attempt === 80) {
                debug.trace("viewer", "waiting for matching stock Documentation render", {
                    serial: serial,
                    attempt: attempt,
                    name: data.name,
                    heading: heading,
                    wrapper: !!wrapper,
                    browser: describeBrowser(browser)
                });
            }
            if (attempt >= 80) return;
            timers.setTimeout(function() {
                waitForStockRender(data, serial, browser, callback, attempt + 1);
            }, 25);
            return;
        }

        debug.trace("viewer", "matching stock Documentation render is ready", {
            serial: serial,
            name: data.name,
            attempt: attempt,
            heading: heading
        });
        callback(viewWindow);
    }

    this.schedule = function(index, serial, browser) {
        lastSerial = serial;
        debug.trace("viewer", "schedule() entered", {
            index: index,
            serial: serial,
            browser: describeBrowser(browser)
        });

        var scope = scopeService();
        if (!scope) {
            debug.trace("viewer", "schedule() aborted: koScopeDocs service unavailable", {
                index: index,
                contract: SCOPE_DOCS_CONTRACT
            });
            return;
        }

        try {
            scope.info(index, function(first, second) {
                if (serial != lastSerial) return;

                var data;
                try { data = decodeInfo(first, second); }
                catch (e) {
                    debug.exception("viewer", "could not decode scope-docs entry data", e);
                    return;
                }
                if (!data) return;

                var parents = [];
                if (data.parents && data.parents.length) {
                    for (var i = 0; i < data.parents.length; i++) parents.push(data.parents[i].name || "");
                }

                debug.trace("viewer", "decoded CIX entry", {
                    entry_id: data.entry_id,
                    doc_name: data.doc_name,
                    name: data.name,
                    type: data.type,
                    signature: data.signature,
                    docLength: data.doc ? String(data.doc).length : 0,
                    parents: parents
                });

                if (data.doc_name != "Perl") return;
                if (data.doc && String(data.doc).trim()) {
                    debug.trace("viewer", "CIX doc exists; stock preview left untouched", {
                        name: data.name,
                        docLength: String(data.doc).length
                    });
                    return;
                }

                waitForStockRender(data, serial, browser, function(viewWindow) {
                    if (serial != lastSerial) return;
                    renderSection(viewWindow, data.name, "Loading local documentation…");
                    debug.trace("viewer", "calling perldoc.lookup()", {name: data.name, parents: parents});

                    perldoc.lookup(data, function(result) {
                        debug.trace("viewer", "perldoc.lookup() callback", {
                            name: data.name,
                            ok: !!result.ok,
                            miss: !!result.miss,
                            title: result.title,
                            outputLength: result.output ? result.output.length : 0,
                            errorLength: result.error ? result.error.length : 0,
                            stale: serial != lastSerial,
                            stillShowing: stillShowing(viewWindow)
                        });

                        if (serial != lastSerial || !stillShowing(viewWindow)) return;
                        if (result.ok) {
                            renderSection(viewWindow, result.title || data.name, result.output);
                            return;
                        }

                        // A normal local miss is not an error worth showing in
                        // the Documentation UI.  Leave the stock CIX page alone
                        // rather than rendering raw Pod::Perldoc diagnostics.
                        if (result.miss) {
                            removeSection(viewWindow, "local perldoc miss");
                            return;
                        }

                        var message = result.error || result.output || "Local Pod::Perldoc returned no documentation.";
                        renderSection(viewWindow, result.title || data.name, message);
                    });
                });
            });
        } catch (e) {
            debug.exception("viewer", "scope.info() threw synchronously", e);
        }
    };
}).apply(module.exports);
