(function() {
    const {Cc, Ci} = require("chrome");
    const prefs    = require("ko/prefs");
    const timers   = require("sdk/timers");
    const debug    = require("./debug");

    const runSvc = Cc["@activestate.com/koRunService;1"].getService(Ci.koIRunService);
    const runtime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
    const TIMEOUT_MS = 15000;

    var cache = {};

    debug.trace("runner", "module evaluated", {
        os: runtime.OS,
        timeoutMs: TIMEOUT_MS
    });

    function perlInterpreter() {
        var configured = prefs.getString("perlDefaultInterpreter", "");
        var perl = configured || "perl";
        debug.trace("runner", "resolved Perl interpreter", {
            configured: configured || null,
            selected: perl
        });
        return perl;
    }

    function quotePosix(value) {
        value = String(value);
        if (/^[A-Za-z0-9_\-\.\/:=+,%@]+$/.test(value)) return value;
        return "'" + value.replace(/'/g, "'\\''") + "'";
    }

    function quoteWindows(value) {
        value = String(value);
        if (/^[A-Za-z0-9_\-\.\\\/:=+,%@]+$/.test(value)) return value;
        return '"' + value.replace(/([\\"])/g, "\\$1") + '"';
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

        if (data.parents) {
            for (var i = data.parents.length - 1; i >= 0; i--) {
                add(data.parents[i].name);
            }
        }

        if (data.type == "class" || data.type == "interface" || /::/.test(data.name || "")) {
            add(data.name);
        }

        debug.trace("runner", "derived module candidates", {
            name: data.name,
            type: data.type,
            candidates: result
        });
        return result;
    }

    function requestsFor(data) {
        var requests = [];
        var name = data.name || "";

        if (data.type == "variable" || /^[\$@%*]/.test(name)) {
            requests.push({kind: "variable", args: ["-v", name], title: name});
        }

        if (data.type == "function") {
            requests.push({kind: "function", args: ["-f", name], title: name});
        }

        var modules = moduleCandidates(data);
        for (var i = 0; i < modules.length; i++) {
            requests.push({kind: "module", args: [modules[i]], title: modules[i]});
        }

        debug.trace("runner", "lookup request chain built", {
            name: data.name,
            requests: requests
        });
        return requests;
    }

    function isMiss(text) {
        if (!text || !text.trim()) return true;
        return /(?:No documentation found for|No documentation for perl|No module found|No docs found for)/i.test(text);
    }

    function sample(text) {
        if (!text) return "";
        text = String(text).replace(/\r/g, "");
        return text.length > 500 ? text.substr(0, 500) + "…" : text;
    }

    function runRequest(perl, request, callback) {
        var command = commandFor(perl, request.args);
        var process = null;
        var completed = false;
        var timeout = null;

        debug.trace("runner", "starting local perldoc process", {
            kind: request.kind,
            title: request.title,
            command: command
        });

        function finish(result) {
            if (completed) {
                debug.trace("runner", "finish() ignored: request already completed", {title: request.title});
                return;
            }
            completed = true;
            if (timeout) timers.clearTimeout(timeout);

            debug.trace("runner", "request completed", {
                title: result.title,
                ok: !!result.ok,
                miss: !!result.miss,
                returncode: result.returncode,
                outputLength: result.output ? result.output.length : 0,
                errorLength: result.error ? result.error.length : 0,
                stdoutSample: sample(result.output),
                stderrSample: sample(result.error)
            });
            callback(result);
        }

        var onComplete = function(commandString, returncode, stdout, stderr) {
            stdout = stdout || "";
            stderr = stderr || "";

            var combined = (stdout + "\n" + stderr).trim();
            var miss = isMiss(combined);
            var ok = returncode === 0 && !miss && !!stdout.trim();

            debug.trace("runner", "RunAsync callback fired", {
                title: request.title,
                returncode: returncode,
                stdoutLength: stdout.length,
                stderrLength: stderr.length,
                miss: miss,
                ok: ok
            });

            finish({
                ok: ok,
                miss: miss,
                title: request.title,
                command: commandString || command,
                output: stdout,
                error: stderr,
                returncode: returncode
            });
        };

        try {
            process = runSvc.RunAsync(command, onComplete, null, null, null);
            debug.trace("runner", "RunAsync returned process handle", {
                title: request.title,
                hasProcess: !!process,
                uuid: process && process.uuid ? process.uuid : null
            });
        } catch (e) {
            debug.exception("runner", "RunAsync threw while starting Pod::Perldoc", e);
            finish({
                ok: false,
                miss: false,
                title: request.title,
                command: command,
                output: "",
                error: String(e)
            });
            return;
        }

        timeout = timers.setTimeout(function() {
            if (completed) return;
            debug.trace("runner", "lookup timeout reached", {
                title: request.title,
                timeoutMs: TIMEOUT_MS
            });

            try {
                if (process && typeof process.kill == "function") {
                    process.kill(1);
                    debug.trace("runner", "timed-out process killed", {title: request.title});
                }
            } catch (e) {
                debug.exception("runner", "failed to kill timed-out process", e);
            }

            finish({
                ok: false,
                miss: false,
                title: request.title,
                command: command,
                output: "",
                error: "Pod::Perldoc timed out after " + (TIMEOUT_MS / 1000) + " seconds."
            });
        }, TIMEOUT_MS);
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
        debug.trace("runner", "lookup() entered", {
            name: data && data.name,
            type: data && data.type,
            docName: data && data.doc_name
        });

        var perl = perlInterpreter();
        var key = cacheKey(perl, data);

        if (key in cache) {
            debug.trace("runner", "cache hit", {name: data.name, key: key});
            timers.setTimeout(function() { callback(cache[key]); }, 0);
            return;
        }
        debug.trace("runner", "cache miss", {name: data.name, key: key});

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
            debug.trace("runner", "no lookup requests could be derived", {name: data.name});
            timers.setTimeout(function() { callback(empty); }, 0);
            return;
        }

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
                debug.trace("runner", "all lookup candidates exhausted", {
                    name: data.name,
                    errors: errors
                });
                callback(failed);
                return;
            }

            var request = requests[index++];
            debug.trace("runner", "trying lookup candidate", {
                name: data.name,
                candidateIndex: index,
                candidateCount: requests.length,
                request: request
            });

            runRequest(perl, request, function(result) {
                if (result.ok) {
                    result.perl = perl;
                    cache[key] = result;
                    debug.trace("runner", "lookup succeeded", {
                        name: data.name,
                        resolvedTitle: result.title,
                        perl: perl
                    });
                    callback(result);
                    return;
                }

                if (result.error && result.error.trim()) errors.push(result.error.trim());
                if (result.output && result.output.trim() && result.miss) errors.push(result.output.trim());

                // A normal perldoc miss is expected for private module methods:
                // continue to the containing module. Execution failures stop.
                if (result.miss || result.returncode === 1) {
                    debug.trace("runner", "candidate missed; trying next", {
                        title: result.title,
                        returncode: result.returncode,
                        miss: result.miss
                    });
                    next();
                    return;
                }

                var hardFailure = {
                    ok: false,
                    miss: false,
                    title: result.title,
                    output: result.output || "",
                    error: result.error || "Failed to execute Pod::Perldoc.",
                    perl: perl
                };
                cache[key] = hardFailure;
                debug.trace("runner", "hard lookup failure; stopping chain", {
                    title: result.title,
                    returncode: result.returncode,
                    error: result.error
                });
                callback(hardFailure);
            });
        }

        next();
    };

    this.clearCache = function() {
        cache = {};
        debug.trace("runner", "cache cleared");
    };
}).apply(module.exports);
