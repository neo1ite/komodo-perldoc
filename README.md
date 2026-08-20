# Komodo Perldoc

Local `perldoc` fallback for the built-in Documentation browser in Komodo IDE 9.3.x.

Komodo's `scope-docs` indexes Perl documentation from CodeIntel CIX files. Many module symbols contain a signature but no `doc` attribute, so the Documentation preview is otherwise empty. Komodo Perldoc leaves normal CIX documentation untouched and augments only Perl entries whose local CIX `doc` is empty.

## Version 0.1

- Hooks the existing `Documentation` scope; no separate search UI.
- Keeps CodeIntel/CIX search and stock signatures, breadcrumbs, Online Documentation and Insert Snippet actions.
- Uses Komodo's `perlDefaultInterpreter` preference when set, otherwise `perl` from `PATH`.
- Invokes `Pod::Perldoc` through that Perl interpreter, rather than a potentially unrelated system `perldoc` executable.
- Tries `perldoc -f SYMBOL` for function entries, then falls back to the containing module POD.
- Tries `perldoc -v VARIABLE` for variable entries.
- Caches successful and failed lookups for the Komodo window lifetime.
- Times out a stuck local lookup after 15 seconds.
- Does not modify the Komodo installation or `scope-docs.jar`.

### Known 0.1 limitation

For module/private functions that do not have their own `perlfunc` entry (for example `AutoSplit::_check_unique`), 0.1 displays the containing module's POD rather than extracting an exact POD section for the symbol.

Core-function documentation such as `abs` depends on the Perl installation containing the standard `perlfunc`/`perlop` documentation. On Debian/Ubuntu this may require the distribution's Perl documentation package. Module POD, such as `AutoSplit`, normally works directly from the installed module source.

## Build

```sh
./build.sh
```

The script is independent of the current working directory. The default output is:

```text
dist/komodo-perldoc-0.1.xpi
```

## Install

Open Komodo's Add-ons Manager, choose **Install Add-on From File**, select `komodo-perldoc-0.1.xpi`, and restart Komodo if requested.

## Test

Recommended 0.1 smoke tests:

1. Open a Perl file and invoke **Documentation: Open documentation for Current Language**.
2. Search for `_check_unique` from `AutoSplit`. The stock signature should still be visible, followed by a `Perldoc — AutoSplit` section containing the module POD.
3. Search for an entry that already has CIX documentation, for example `abs` on installations where the CIX doc is populated. Komodo Perldoc must leave the stock preview untouched.
4. Click **Online Documentation** and **Insert Snippet** to verify the stock actions still work.
5. Repeat `_check_unique`; the second lookup should come from the in-memory cache.

If the fallback cannot run, the preview shows the captured `Pod::Perldoc` error instead of silently remaining empty. Detailed runner diagnostics are also written through Komodo's logger under `komodo-perldoc-runner`.
