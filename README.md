# Komodo Perldoc

[Русский](#русский) · [English](#english)

## Русский

**Komodo Perldoc** — локальный fallback к `perldoc` для встроенного браузера документации Komodo IDE 9.3.x.

Komodo строит Perl-документацию из CodeIntel CIX. У части символов есть сигнатура, но нет `doc`; расширение сохраняет штатный поиск и viewer, а для таких записей добавляет локальный POD через выбранный Perl.

### Версия 0.1.10

Рабочая цепочка для пустого CIX `doc`:

```text
CIX entry
  -> для function: perldoc -f SYMBOL
  -> при miss: perldoc содержащего MODULE
  -> секция Perldoc в штатном Documentation viewer
```

Например `_check_unique` приводит к `Perldoc — AutoSplit`. Для установленных модулей работает тот же механизм: если POD конкретного вложенного модуля отсутствует, поиск может подняться к содержащему модулю.

0.1.10 также:

- использует событийный monitor без постоянного polling;
- исправляет старый Commando 9.3: одиночный клик мышью по другому результату Documentation обновляет stock preview;
- исправляет `Perl (1)` непосредственно в monitor: в момент клика `scope-docs -> Perl` уже активен, поэтому код снимает `maximized` и вызывает `clear()`/`search("")` внутри текущего Perl-subscope;
- не monkey-patch'ит `showSubscope()` и не вызывает `selectScope("scope-docs")`, который сбрасывал Perl-subscope до списка языков;
- исправляет видимые опечатки штатного `scope-docs`: `Classs -> Classes`, `Propertys -> Properties`;
- при обычном `perldoc` miss не показывает пользователю сырой stderr (`No documentation found ...`), а оставляет штатную CIX-страницу;
- использует classic XUL overlay, поэтому установка и обновление требуют перезапуска Komodo;
- не изменяет `scope-docs.jar` и системные файлы Komodo.

### Диагностика

```text
~/.komodoide/9.3/XRE/komodo-perldoc-debug.log
```

### Сборка

```sh
./build.sh
```

Результат:

```text
dist/komodo-perldoc-0.1.10.xpi
```

### Smoke test

1. Установить `dist/komodo-perldoc-0.1.10.xpi` и перезапустить Komodo по запросу Add-on Manager.
2. Открыть `Documentation -> Perl` и проверить переключение результатов одиночным click.
3. Открыть maximized viewer, перейти на родительскую страницу и нажать `Perl (1)`: должен открыться корень текущего Perl-subscope, без списка HTML5/JavaScript/... и без `undefined`.
4. Проверить `_check_unique`: `Perldoc — AutoSplit` должен по-прежнему появляться.

---

## English

**Komodo Perldoc** adds a local `perldoc` fallback to Komodo IDE 9.3.x's built-in Documentation browser while preserving stock search and navigation.

### Version 0.1.10

- event-driven monitoring; no permanent polling;
- local `Pod::Perldoc` fallback for CIX entries with empty `doc`;
- fixes Komodo 9.3 mouse result selection so a single click refreshes the stock Documentation preview;
- fixes `Perl (1)` directly in the monitor by preserving the already-active Perl subscope and clearing its query;
- no longer monkey-patches `showSubscope()` or reselects the top-level Documentation scope;
- normalizes stock `Classs`/`Propertys` headings to `Classes`/`Properties`;
- hides normal local perldoc misses instead of rendering raw diagnostics;
- uses a classic XUL overlay, so installation/upgrades require a Komodo restart;
- does not modify `scope-docs.jar` or Komodo system files.

Diagnostics:

```text
~/.komodoide/9.3/XRE/komodo-perldoc-debug.log
```

Build:

```sh
./build.sh
```

Output:

```text
dist/komodo-perldoc-0.1.10.xpi
```
