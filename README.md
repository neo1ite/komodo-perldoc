# Komodo Perldoc

[Русский](#русский) · [English](#english)

## Русский

**Komodo Perldoc** — локальный fallback к `perldoc` для встроенного браузера документации Komodo IDE 9.3.x.

Komodo строит Perl-документацию из CodeIntel CIX. У части символов есть сигнатура, но нет `doc`; расширение сохраняет штатный поиск и viewer, а для таких записей добавляет локальный POD через выбранный Perl.

### Версия 0.1.8

Рабочая цепочка для пустого CIX `doc`:

```text
CIX entry
  -> для function: perldoc -f SYMBOL
  -> при miss: perldoc содержащего MODULE
  -> секция Perldoc в штатном Documentation viewer
```

Например `_check_unique` приводит к `Perldoc — AutoSplit`. Для установленных модулей работает тот же механизм: если POD конкретного вложенного модуля отсутствует, поиск может подняться к содержащему модулю (например `CPAN::Index` -> `CPAN`).

0.1.8 также:

- использует событийный monitor без постоянного polling;
- исправляет старый Commando 9.3: клик мышью по другому результату Documentation теперь запускает тот же stock preview path, что и навигация клавишами;
- исправляет legacy-переход `Perl (1)`: если старый `selectScope()` не вызывает callback, compatibility shim гарантированно отпускает его один раз после короткого таймаута, после чего выбирается `docs-Perl`;
- исправляет штатный битый breadcrumb `Perl (1)` с синтетическим `index=0`, которого нет в БД;
- исправляет видимые опечатки штатного `scope-docs`: `Classs -> Classes`, `Propertys -> Properties`;
- при обычном `perldoc` miss больше не показывает пользователю сырой stderr (`No documentation found ...`), а оставляет штатную CIX-страницу без дополнительной секции;
- использует classic XUL overlay, поэтому установка и обновление требуют перезапуска Komodo;
- по-прежнему не изменяет `scope-docs.jar` и системные файлы Komodo.

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
dist/komodo-perldoc-0.1.8.xpi
```

### Smoke test

1. Установить `dist/komodo-perldoc-0.1.8.xpi` и перезапустить Komodo по запросу Add-on Manager.
2. Открыть `Documentation -> Perl` и найти несколько одинаково называющихся символов из разных модулей, например `address`.
3. Переключаться между результатами обычным одиночным кликом: правая preview-панель должна меняться без Enter/double-click.
4. Открыть вложенную страницу и нажать `Perl (1)` — должен открыться именно Perl-subscope, а не список языков и не `undefined`.
5. Проверить `_check_unique`/`userid`: локальный Perldoc должен по-прежнему появляться.
6. Выбрать символ без доступного локального POD (например наблюдавшийся `Mac::Glue::ADDRESS`): сырой вывод `No documentation found ...` не должен оставаться в UI.

---

## English

**Komodo Perldoc** adds a local `perldoc` fallback to Komodo IDE 9.3.x's built-in Documentation browser while preserving stock search and navigation.

### Version 0.1.8

- event-driven monitoring; no permanent polling;
- local `Pod::Perldoc` fallback for CIX entries with empty `doc`;
- fixes Komodo 9.3 mouse result selection so a single click refreshes the stock Documentation preview;
- fixes legacy `Perl (1)` navigation when old Commando does not invoke `selectScope()` callbacks reliably;
- normalizes stock `Classs`/`Propertys` headings to `Classes`/`Properties`;
- hides normal local perldoc misses instead of rendering raw diagnostics in the Documentation page;
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
dist/komodo-perldoc-0.1.8.xpi
```
