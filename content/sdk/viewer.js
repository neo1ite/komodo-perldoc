(function() {
    const $        = require("ko/dom");
    const {Cc, Ci} = require("chrome");
    const timers   = require("sdk/timers");
    const perldoc  = require("./perldoc");
    const log      = require("ko/logging").getLogger("komodo-perldoc-viewer");

    const scope   = Cc["@activestate.com/commando/koScopeDocs;1"].getService(Ci.koIScopeDocs);
    const _window = require("ko/windows").getMain();

    var lastSerial = 0;

    function currentViewWindow() {
        var preview = $("#doc-preview", _window);
        if (!preview.length) return null;
        return preview.element().contentWindow;
    }

    function ensurePerldocSection(viewWindow, title, body, isError, attempt) {
        attempt = attempt || 0;
        if (!viewWindow || currentViewWindow() !== viewWindow) return;

        var wrapper = viewWindow.document.getElementById("wrapper");
        if (!wrapper) {
            if (attempt < 10) {
                timers.setTimeout(function() {
                    ensurePerldocSection(viewWindow, title, body, isError, attempt + 1);
                }, 25);
            }
            return;
        }

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
        pre.textContent = body || (isError ? "Local perldoc lookup failed." : "Loading local documentation…");
        section.appendChild(pre);
    }

    this.augment = function(index, serial) {
        lastSerial = serial;

        var viewWindow = currentViewWindow();
        if (!viewWindow) {
            log.warn("Documentation preview window is not available");
            return;
        }

        scope.info(index, function(status, results) {
            if (serial != lastSerial || currentViewWindow() !== viewWindow) return;
            if (!results) {
                log.warn("scope-docs returned no entry data for index " + index);
                return;
            }

            var data;
            try {
                data = JSON.parse(results);
            } catch (e) {
                log.exception(e, "Could not decode scope-docs entry data");
                return;
            }

            if (!data || data.doc_name != "Perl") return;
            if (data.doc && String(data.doc).trim()) {
                log.debug("CIX documentation already exists for " + data.name + "; leaving stock preview untouched");
                return;
            }

            log.debug("CIX documentation is empty for " + data.name + "; requesting local perldoc");
            ensurePerldocSection(viewWindow, data.name, "Loading local documentation…", false);

            perldoc.lookup(data, function(result) {
                if (serial != lastSerial || currentViewWindow() !== viewWindow) return;

                if (result.ok) {
                    ensurePerldocSection(viewWindow, result.title || data.name, result.output, false);
                    return;
                }

                var message = result.error || result.output || "Local Pod::Perldoc returned no documentation.";
                ensurePerldocSection(viewWindow, result.title || data.name, message, true);
            });
        });
    };
}).apply(module.exports);
