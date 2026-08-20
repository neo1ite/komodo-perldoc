(function() {
    const {Cc, Ci} = require("chrome");
    const prefs    = require("ko/prefs");
    const timers   = require("sdk/timers");
    const log      = require("ko/logging").getLogger("komodo-perldoc-runner");

    const runSvc = Cc["@activestate.com/koRunService;1"].getService(Ci.koIRunService);
    const runtime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);

    const POLL_INTERVAL = 50;
    const TIMEOUT_MS = 15000;

    var cache = {};
    var running = [];

    function perlInterpreter() {
        var perl = prefs.getString("perlDefaultInterpreter", "");
        if (perl) return perl;
        return "perl";
    }

    function quotePosix(value) {
        value = String(value);
        if (/^[A-Za-z0-9_\-\.\/:=+,%@]+$/.test(value)) return value;
        return "'" + value.replace(/'/g, "'\\''") + "'";
    }

    function quoteWindows(value) {
        value = String(value);
        if (/^[A-Za-z0-9_\-\.\\\/:=+,%@]+$/.test(value)) return value;

        var out = '"';
        var slashCount = 0;
        for (var i = 0; i < value.length; i++) {
            var ch = value.charAt(i);
            if (ch == "\\") {
                slashCount++;
                continue;
            }
            if (ch == '"') {
                out += new Array(slashCount * 2 + 2).join("\\") + '"';
                slashCount = 0;
                continue;
            }
            if (slashCount) {
                out += new Array(slashCount + 1).join("\\");
                slashCount = 0;
            }
            out += ch;
        }
        if (slashCount) {
            out += new Array(slashCount * 2 + 1).join("\\");
        }
        return out + '"';
    }

    function quote(value) {
        return runtime.OS == "WINNT" ? quoteWindows(value) : quotePosix(value);
    }

    function commandFor(perl, args) {
        var argv = [
            perl,
            "-MPod::Perldoc",
            "-e",
            "Pod::Perldoc->run()",
            "--",
            "-T"
        ].concat(args);

        return argv.map(quote).join(" ");
    }

    function moduleCandidates(data) {
        var result = [];
        var seen = {};

        function add(name) {
            if (!name || name == "Perl" || seen[name]) return;
            if (!/^[A-Za-z_]\w*(?:::\w+)*$/.test(name)) return;
            seen[name] = true;
            result.push(name);
        }

        if (data.parents && data.parents.length) {
            for (var i = data.parents.length - 1; i >= 0; i--) {
                add(data.parents[i].name);
            }
        }

        if (data.type == "class" || data.type == "interface" || /::/.test(data.name || "")) {
            add(data.name);
        }

        return result;
    }

    function requestsFor(data) {
        var requests = [];
        var name = data.name || "";
        var variable = data.type == "variable" || /^[\$@%*]/.test(name);

        if (variable) {
            requests.push({
                kind: "variable",
                args: ["-v", name],
                title: name
            });
        }

        if (data.type == "function") {
            requests.push({
                kind: "function",
                args: ["-f", name],
                title: name
            });
        }

        var modules = moduleCandidates(data);
        for (var i = 0; i < modules.length; i++) {
            requests.push({
                kind: "module",
                args: [modules[i]],
                title: modules[i]
            });
        }

        return requests;
    }

    function removeRunning(process) {
        var next = [];
        for (var i = 0; i < running.length; i++) {
            if (running[i] !== process) next.push(running[i]);
        }
        running = next;
    }

    function isMiss(text) {
        if (!text || !text.trim()) return true;
        return /(?:No documentation found for|No documentation for perl|No module found|No docs found for)/i.test(text);
    }

    function runRequest(perl, request, callback) {
        var command = commandFor(perl, request.args);
        var process;

        log.debug("Running " + request.kind + " perldoc lookup: " + command);

        try {
            process = runSvc.RunAndNotify(command, null, null, null);
        } catch (e) {
            log.exception(e, "Komodo Perldoc: failed to start Pod::Perldoc");
            callback({
                ok: false,
                miss: false,
                title: request.title,
                command: command,
                output: "",
                error: String(e)
            });
            return;
        }

        running.push(process);
        var started = Date.now();

        function finish() {
            var stdout = "";
            var stderr = "";

            try { stdout = process.getStdout() || ""; } catch (e) {}
            try { stderr = process.getStderr() || ""; } catch (e) {}

            removeRunning(process);

            var combined = (stdout + "\n" + stderr).trim();
            var miss = isMiss(combined);
            var result = {
                ok: !miss && !!stdout.trim(),
                miss: miss,
                title: request.title,
                command: command,
                output: stdout,
                error: stderr
            };

            if (result.ok) {
                log.debug("Perldoc lookup succeeded for " + request.title);
            } else if (result.miss) {
                log.debug("Perldoc lookup missed for " + request.title);
            } else {
                log.warn("Perldoc lookup failed for " + request.title + ": " + (stderr || stdout || "no output"));
            }

            callback(result);
        }

        function poll() {
            try {
                process.wait(0);
                finish();
                return;
            } catch (e) {
            }

            if (Date.now() - started >= TIMEOUT_MS) {
                try {
                    if (typeof process.kill == "function") process.kill(1);
                } catch (e) {}

                removeRunning(process);
                log.warn("Perldoc lookup timed out for " + request.title);
                callback({
                    ok: false,
                    miss: false,
                    title: request.title,
                    command: command,
                    output: "",
                    error: "Pod::Perldoc timed out after " + (TIMEOUT_MS / 1000) + " seconds."
                });
                return;
            }

            timers.setTimeout(poll, POLL_INTERVAL);
        }

        timers.setTimeout(poll, 0);
    }

    function cacheKey(perl, data) {
        var parents = [];
        if (data.parents) {
            for (var i = 0; i < data.parents.length; i++) {
                parents.push(data.parents[i].name || "");
            }
        }
        return [perl, data.type || "", data.name || "", parents.join("::")].join("\x1f");
    }

    this.lookup = function(data, callback) {
        var perl = perlInterpreter();
        var key = cacheKey(perl, data);

        if (key in cache) {
            log.debug("Using cached perldoc result for " + (data.name || "Perl"));
            timers.setTimeout(function() { callback(cache[key]); }, 0);
            return;
        }

        var requests = requestsFor(data);
        if (!requests.length) {
            var empty = {
                ok: false,
                miss: true,
                title: data.name || "Perl",
                output: "",
                error: "No local perldoc lookup can be derived from this CIX entry."
            };
            cache[key] = empty;
            timers.setTimeout(function() { callback(empty); }, 0);
            return;
        }

        log.debug("Looking up " + (data.name || "Perl") + " with " + perl + "; candidates: " +
                  requests.map(function(request) { return request.kind + ":" + request.title; }).join(", "));

        var errors = [];
        var index = 0;

        function next() {
            if (index >= requests.length) {
                var failed = {
                    ok: false,
                    miss: true,
                    title: data.name || "Perl",
                    output: "",
                    error: errors.join("\n\n") || "Local Pod::Perldoc returned no documentation."
                };
                cache[key] = failed;
                callback(failed);
                return;
            }

            var request = requests[index++];
            runRequest(perl, request, function(result) {
                if (result.ok) {
                    result.perl = perl;
                    cache[key] = result;
                    callback(result);
                    return;
                }

                if (result.error && result.error.trim()) {
                    errors.push(result.error.trim());
                }
                if (result.output && result.output.trim() && result.miss) {
                    errors.push(result.output.trim());
                }

                if (!result.miss && !result.output) {
                    var hardFailure = {
                        ok: false,
                        miss: false,
                        title: result.title,
                        output: "",
                        error: result.error || "Failed to execute Pod::Perldoc.",
                        perl: perl
                    };
                    cache[key] = hardFailure;
                    callback(hardFailure);
                    return;
                }

                next();
            });
        }

        next();
    };

    this.clearCache = function() {
        cache = {};
    };
}).apply(module.exports);
