# Komodo Perldoc

Local `perldoc` fallback for the built-in Documentation browser in Komodo IDE 9.3.x.

Komodo's `scope-docs` indexes Perl documentation from CodeIntel CIX files. Many module symbols contain a signature but no `doc` attribute, so the Documentation preview is otherwise empty. Komodo Perldoc leaves normal CIX documentation untouched and augments only Perl entries whose local CIX `doc` is empty.

## Version 0.1

- Hooks the existing `Documentation` scope; no separate search UI.
- Keeps CodeIntel/CIX search and stock signatures, breadcrumbs, Online Documentation and Insert Snippet actions.
- Uses Komodo's `perlDefaultInterpreter` preference when set, otherwise `perl` from `PATH`.
- Invokes `Pod::Perldoc` through that Perl interpreter, rather than a potentially unrelated system `perldoc` executable.
- Tries `perldoc -f SYMBOL` for function entries, then falls back to the containing module POD.
- Caches successful and failed lookups for the Komodo window lifetime.
- Does not modify the Komodo installation or `scope-docs.jar`.

### Known 0.1 limitation

For module/private functions that do not have their own `perlfunc` entry (for example `AutoSplit::_check_unique`), 0.1 displays the containing module's POD rather than extracting an exact POD section for the symbol.

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

Open a Perl file, invoke **Documentation: Open documentation for Current Language**, search for a CIX entry whose preview previously had only a signature (for example `_check_unique` from `AutoSplit`), and select it. The normal preview should remain intact and a `Perldoc — ...` section should appear below it.

If the fallback cannot run, the preview shows the captured `Pod::Perldoc` error instead of silently remaining empty.
