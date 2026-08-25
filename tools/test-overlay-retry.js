#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");
var assert = require("assert");

var timers = {};
var nextTimer = 1;
var listeners = {};

var context = {
    Components: {
        classes: {},
        interfaces: { nsIFile: function() {} },
        utils: { import: function() {} }
    },
    Services: {
        dirsvc: { get: function() { throw new Error("no profile in test"); } },
        console: { logStringMessage: function() {} }
    },
    document: { readyState: "loading" },
    JSON: JSON,
    Date: Date,
    Math: Math,
    String: String,
    setTimeout: function(fn, delay) {
        var id = nextTimer++;
        timers[id] = { fn: fn, delay: delay };
        return id;
    },
    clearTimeout: function(id) { delete timers[id]; },
    addEventListener: function(name, fn) { listeners[name] = fn; },
    removeEventListener: function(name, fn) {
        if (listeners[name] === fn) delete listeners[name];
    },
    location: { href: "chrome://komodo/content/komodo.xul" }
};
context.window = context;

var source = fs.readFileSync(path.join(__dirname, "..", "content", "overlay.js"), "utf8");
vm.runInNewContext(source, context, { filename: "overlay.js" });

function activeTimers() {
    return Object.keys(timers).map(function(id) { return timers[id]; });
}

function runOnlyTimer() {
    var ids = Object.keys(timers);
    assert.strictEqual(ids.length, 1, "exactly one retry timer must be active");
    var item = timers[ids[0]];
    delete timers[ids[0]];
    item.fn();
}

assert.strictEqual(activeTimers().length, 1, "overlay fallback schedules one initial timer");
assert.strictEqual(activeTimers()[0].delay, 0);
assert.ok(listeners["komodo-post-startup"], "post-startup listener must be installed");

listeners["komodo-post-startup"]();
assert.strictEqual(activeTimers().length, 1, "post-startup must replace, not duplicate, the retry chain");
assert.strictEqual(activeTimers()[0].delay, 100);

runOnlyTimer();
assert.strictEqual(activeTimers().length, 1);
assert.strictEqual(activeTimers()[0].delay, 200);

runOnlyTimer();
assert.strictEqual(activeTimers().length, 1);
assert.strictEqual(activeTimers()[0].delay, 400);

runOnlyTimer();
assert.strictEqual(activeTimers().length, 1);
assert.strictEqual(activeTimers()[0].delay, 800);

runOnlyTimer();
assert.strictEqual(activeTimers().length, 1);
assert.strictEqual(activeTimers()[0].delay, 1000);

console.log("overlay-retry: OK");
