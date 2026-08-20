module.exports = function(index, viewType) {
    const docs      = require("scope-docs/docs");
    const commando  = require("commando/commando");
    const perldoc   = require("./perldoc");
    const $         = require("ko/dom");
    const {Cc, Ci}  = require("chrome");
    const prefs     = require("ko/prefs");

    const scope     = Cc["@activestate.com/commando/koScopeDocs;1"].getService(Ci.koIScopeDocs);
    const _window   = require("ko/windows").getMain();
    const KeyEvent  = _window.KeyEvent;

    viewType = viewType || "preview";

    var data;
    var numberPressed = false;
    var numberTimer = false;
    var viewWindow = null;

    function init() {
        var preview = $("#commando-preview", _window);
        preview.empty();

        var browser = $($.create("browser", {
            id: "doc-preview",
            type: "chrome",
            src: "chrome://scope-docs/content/views/" + viewType + ".html",
            flex: 1
        }).toString());
        preview.append(browser);

        if (viewType == "view") {
            commando.preview();
            commando.maximizePreview();
        }
    }

    function currentViewWindow() {
        var preview = $("#doc-preview", _window);
        if (!preview.length) return null;
        return preview.element().contentWindow;
    }

    function stillCurrent() {
        return !!viewWindow && currentViewWindow() === viewWindow;
    }

    function ensurePerldocSection(title, body, isError) {
        if (!stillCurrent()) return;

        var w = viewWindow;
        var wrapper = w.document.getElementById("wrapper");
        if (!wrapper) return;

        var section = w.document.getElementById("komodo-perldoc");
        if (!section) {
            section = w.document.createElement("section");
            section.id = "komodo-perldoc";
            wrapper.appendChild(section);
        }

        while (section.firstChild) section.removeChild(section.firstChild);

        var heading = w.document.createElement("h2");
        heading.textContent = "Perldoc" + (title ? " — " + title : "");
        section.appendChild(heading);

        var pre = w.document.createElement("pre");
        pre.id = "komodo-perldoc-output";
        pre.style.whiteSpace = "pre-wrap";
        pre.style.wordWrap = "break-word";
        pre.textContent = body || (isError ? "Local perldoc lookup failed." : "Loading local documentation…");
        section.appendChild(pre);
    }

    function loadPerldocIfNeeded() {
        if (!data || data.doc_name != "Perl") return;
        if (data.doc && String(data.doc).trim()) return;

        ensurePerldocSection(data.name, "Loading local documentation…", false);

        perldoc.lookup(data, function(result) {
            if (!stillCurrent()) return;

            if (result.ok) {
                ensurePerldocSection(result.title || data.name, result.output, false);
                return;
            }

            var message = result.error || result.output || "Local Pod::Perldoc returned no documentation.";
            ensurePerldocSection(result.title || data.name, message, true);
        });
    }

    this.onReady = function() {
        var preview = $("#doc-preview", _window);
        if (!preview.length) return;

        var w = preview.element().contentWindow;
        viewWindow = w;

        _window.ko.skin._loadVirtualStyle("scheme-skinning-partial", w);
        w.addEventListener("keydown", onKeyNav.bind(this));

        scope.info(index, function(status, results) {
            if (!stillCurrent()) return;
            if (!results) return;

            data = JSON.parse(results);
            this.loadView();

            $("#open-in-browser", w).on("click", docs.openOnline.bind(docs, data.entry_id));
            $("#insert-snippet", w).on("click", docs.insertSignatureFor.bind(docs, data.entry_id));
            $("a", w).on("click", onClickLink);

            loadPerldocIfNeeded();

            if (viewType == "view") {
                preview.focus();
                w.focus();
            }
        }.bind(this));
    };

    this.loadView = function() {
        var w = currentViewWindow();
        if (!w) return;

        var doT = require("contrib/dot");
        var text = $("#tpl-specs-md", w).text();
        text = text.replace(/\n/g, "?n?");
        var template = doT.template(text);
        var md = template(data);
        md = md.replace(/\?n\?/g, "\n");

        var marked = require("contrib/marked");
        var html = marked(md);
        $("#wrapper", w).html(html);
    };

    function onKeyNav(e) {
        var prevent = false;
        switch (e.keyCode) {
            case KeyEvent.DOM_VK_ESCAPE:
                var panel = $("#commando-panel", _window);
                if (panel.hasClass("maximized")) {
                    commando.onPreview();

                    _window.setTimeout(function() {
                        commando.center();
                        commando.focus();
                        $("#commando-search").element().select();
                    }, 100);

                    prevent = true;
                }
                break;

            case KeyEvent.DOM_VK_D:
                docs.openOnline(data.entry_id);
                prevent = true;
                break;

            case KeyEvent.DOM_VK_I:
                docs.insertSignatureFor(data.entry_id);
                prevent = true;
                break;
        }

        var numbers = [0,1,2,3,4,5,6,7,8,9];
        for (var i = 0; i < numbers.length; i++) {
            var number = numbers[i];
            if (e.keyCode != KeyEvent["DOM_VK_" + number]) continue;

            if (numberPressed === false) numberPressed = "";
            numberPressed += number;

            var delay = prefs.getLongPref("commando_number_select_delay");
            _window.clearTimeout(numberTimer);
            numberTimer = _window.setTimeout(onNumberNav, delay);
            prevent = true;
        }

        if (prevent) {
            e.preventDefault();
            return false;
        }
    }

    function onNumberNav() {
        var preview = $("#doc-preview", _window);
        if (!preview.length) return;

        var w = preview.element().contentWindow;
        var link = $('.link-key[link-index="' + numberPressed + '"]', w);
        if (!link.length) return;

        var targetIndex = link.attr("index");
        if (targetIndex == "0") {
            commando.setSubscope({
                id: "docs-" + data.doc_name,
                name: data.doc_name,
                scope: "scope-docs",
                isScope: true
            });
            commando.onPreview();
        } else {
            docs.preview(targetIndex, "view");
        }

        numberPressed = false;
    }

    function onClickLink() {
        var link = $(this);
        if (link.attr("index")) {
            docs.preview(link.attr("index"), "view");
        }
    }

    init();
};
