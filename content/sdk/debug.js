(function() {
    const {Cc, Ci} = require("chrome");

    const PREFIX = "[komodo-perldoc 0.1.3]";
    const consoleSvc = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
    const dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    function debugFile() {
        var file = dirSvc.get("ProfD", Ci.nsIFile);
        file.append("komodo-perldoc-debug.log");
        return file;
    }

    function safeString(value) {
        if (value === undefined) return "undefined";
        if (value === null) return "null";
        if (typeof value == "string") return value;

        try {
            return JSON.stringify(value);
        } catch (e) {
            try {
                return String(value);
            } catch (ignored) {
                return "<unprintable>";
            }
        }
    }

    function timestamp() {
        try {
            return new Date().toISOString();
        } catch (e) {
            return String(new Date());
        }
    }

    function append(line) {
        try {
            var file = debugFile();
            var stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
            stream.init(file, 0x02 | 0x08 | 0x10, 420, 0); // write | create | append, 0644

            var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
            converter.init(stream, "UTF-8", 0, 0);
            converter.writeString(line + "\n");
            converter.close();
        } catch (e) {
            try {
                consoleSvc.logStringMessage(PREFIX + " [debug] failed to write trace file: " + e);
            } catch (ignored) {}
        }
    }

    this.trace = function(component, message, details) {
        var line = timestamp() + " " + PREFIX + " [" + component + "] " + message;
        if (details !== undefined) line += " | " + safeString(details);

        try { consoleSvc.logStringMessage(line); } catch (e) {}
        append(line);
    };

    this.exception = function(component, message, error) {
        var details = "";
        if (error) {
            try { details += error.name ? error.name + ": " : ""; } catch (e) {}
            try { details += error.message || String(error); } catch (e) {}
            try { if (error.stack) details += "\n" + error.stack; } catch (e) {}
        }
        this.trace(component, message, details || "<no exception details>");
    };

    this.path = function() {
        try { return debugFile().path; } catch (e) { return "<unavailable>"; }
    };
}).apply(module.exports);
