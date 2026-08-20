(function() {
    const $        = require("ko/dom");
    const {Cc, Ci} = require("chrome");
    const timers   = require("sdk/timers");
    const perldoc  = require("./perldoc");
    const log      = require("ko/logging").getLogger("komodo-perldoc-viewer");

    const scope   = Cc["@activestate.com/commando/koScopeDocs;1"].getService(Ci.koIScopeDocs);
    const _window = require("ko/windows").getMain();

    var lastSerial = 0;

    function currentBrowser() {
        var preview = $("#doc-preview", _window);
        if (!preview.length) return null;
        return preview.element();
    }

    function decodeInfo(first, second) {
        var raw = null;

        if (typeof second == "string" && second) {
            raw = second;
        } else if (typeof first == "string" && first) {
            raw = first;
        }

        if (!raw) return null;
        return JSON.parse(raw);
    }

    function renderSection(viewWindow, title, body) {
        var wrapper = viewWindow.document.getElementById("wrapper");
        if (!wrapper) return false;

        var section = viewWindow.document.getElementById("komodo-perldoc");
        if (!section) {
            section = viewWindow.document.createElement("section");
            section.id = "komodo-perldoc";
            wrapper.appendChild(section);
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
        return true;
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

        // A newer Documentation preview replaced the one that belongs to this
        // lookup.  Never write stale perldoc into the new page.
        if (!browser || current !== browser) return;

        var viewWindow = browser.contentWindow;
        var wrapper = viewWindow && viewWindow.document && viewWindow.document.getElementById("wrapper");
        var text = wrapper ? (wrapper.textContent || "") : "";

        // The browser document can be loaded before scope-docs has rendered its
        // template.  Wait until the selected symbol is actually present.
        if (!wrapper || !wrapper.firstChild || (data.name && text.indexOf(data.name) == -1)) {
            if (attempt >= 80) {
                log.warn("Komodo Perldoc: stock preview did not become ready for " + data.name);
                return;
            }

            timers.setTimeout(function() {
                waitForStockRender(data, serial, browser, callback, attempt + 1);
            }, 25);
            return;
        }

        callback(viewWindow);
    }

    this.schedule = function(index, serial, browser) {
        lastSerial = serial;

        scope.info(index, function(first, second) {
            if (serial != lastSerial) return;

            var data;
            try {
                data = decodeInfo(first, second);
            } catch (e) {
                log.exception(e, "Komodo Perldoc: could not decode scope-docs entry data");
                return;
            }

            if (!data) {
                log.warn("Komodo Perldoc: scope-docs returned no entry data for index " + index);
                return;
            }
            if (data.doc_name != "Perl") return;
            if (data.doc && String(data.doc).trim()) return;

            log.warn("Komodo Perldoc: empty CIX doc for " + data.name + "; starting local lookup");

            waitForStockRender(data, serial, browser, function(viewWindow) {
                if (serial != lastSerial) return;

                renderSection(viewWindow, data.name, "Loading local documentation…");

                perldoc.lookup(data, function(result) {
                    if (serial != lastSerial || !stillShowing(viewWindow)) return;

                    if (result.ok) {
                        renderSection(viewWindow, result.title || data.name, result.output);
                        return;
                    }

                    var message = result.error || result.output || "Local Pod::Perldoc returned no documentation.";
                    renderSection(viewWindow, result.title || data.name, message);
                });
            });
        });
    };
}).apply(module.exports);
