# Komodo Perldoc

[Русский](#русский) · [English](#english)

## Русский

**Komodo Perldoc** — локальный fallback к `perldoc` для встроенного браузера документации Komodo IDE 9.3.x.

Komodo строит Perl-документацию из CodeIntel CIX. У части символов есть сигнатура, но нет `doc`; расширение сохраняет штатный поиск и viewer, а для таких записей добавляет локальный POD через выбранный Perl.

### Версия 0.1.7

Рабочая цепочка для пустого CIX `doc`:

```text
CIX entry
  -> для function: perldoc -f SYMBOL
  -> при miss: perldoc содержащего MODULE
  -> секция Perldoc в штатном Documentation viewer
```

Например `_check_unique` приводит к `Perldoc — AutoSplit`. Для установленных модулей работает тот же механизм: если POD конкретного вложенного модуля отсутствует, поиск может подняться к содержащему модулю (например `CPAN::Index` -> `CPAN`).

0.1.7 также:

- использует событийный monitor без постоянного polling;
- различает preview и maximized Documentation viewer;
- не добавляет Perldoc после внутренней навигации viewer на другой символ;
- исправляет штатный битый breadcrumb `Perl (1)`: `scope-docs` создаёт синтетический root с `index=0`, которого нет в БД; расширение возвращает Commando в настоящий `Documentation -> Perl`;
- исправляет видимые опечатки штатного `scope-docs`: `Classs -> Classes`, `Propertys -> Properties`;
- переведён с restartless bootstrap add-on на classic XUL overlay. Поэтому установка и обновление должны штатно требовать перезапуска Komodo;
- по-прежнему не изменяет `scope-docs.jar` и системные файлы Komodo.

### Диагностика

```text
~/.komodoide/9.3/XRE/komodo-perldoc-debug.log
```

В логе фиксируются startup/retry, Commando entry, CIX payload, выбранный Perl, команды `Pod::Perldoc`, cache hit/miss и навигация stock viewer.

### Сборка

```sh
./build.sh
```

Результат:

```text
dist/komodo-perldoc-0.1.7.xpi
```

### Smoke test

1. Установить `dist/komodo-perldoc-0.1.7.xpi`; Komodo должна предложить/потребовать restart.
2. После запуска открыть `Documentation -> Perl` и символ с пустым CIX `doc` (например `_check_unique` или `userid`).
3. Проверить Perldoc в preview и maximized viewer.
4. Из вложенной страницы нажать `Perl (1)` — должен открыться корень Perl, а не `undefined`.
5. На страницах классов должны отображаться `Classes` и `Properties`, а не `Classs`/`Propertys`.

---

## English

**Komodo Perldoc** adds a local `perldoc` fallback to Komodo IDE 9.3.x's built-in Documentation browser while preserving stock search and navigation.

### Version 0.1.7

- event-driven monitoring; no permanent polling;
- local `Pod::Perldoc` fallback for CIX entries with empty `doc`;
- function lookup first uses `perldoc -f SYMBOL`, then containing-module POD;
- works with locally installed Perl modules as well as core modules;
- fixes the stock synthetic `Perl (1)` breadcrumb whose invalid `index=0` otherwise renders `undefined`;
- normalizes stock `Classs`/`Propertys` headings to `Classes`/`Properties`;
- uses a classic XUL overlay instead of a restartless bootstrap add-on, so installation/upgrades require a Komodo restart;
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
dist/komodo-perldoc-0.1.7.xpi
```
