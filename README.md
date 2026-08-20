# Komodo Perldoc

[Русский](#русский) · [English](#english)

## Русский

**Komodo Perldoc** — локальный fallback к `perldoc` для встроенного браузера документации Komodo IDE 9.3.x.

Komodo строит локальную Perl-документацию из CodeIntel CIX. У части символов есть сигнатура, но нет `doc`, поэтому штатный preview показывает только имя и сигнатуру. Расширение не меняет `scope-docs.jar` и не заменяет штатный поиск.

### Версия 0.1.4

Диагностика 0.1.3 выявила две отдельные проблемы:

1. обычная навигация Commando не вызывает экспортированный `scope-docs/docs.preview()`, поэтому предыдущий hook стоял не на том пути;
2. порядок запуска bootstrap add-on'ов недетерминирован: `komodo-perldoc` иногда загружался до того, как встроенный `scope-docs` зарегистрировал XPCOM-компонент `@activestate.com/commando/koScopeDocs;1`, что приводило к `Cc[...] is undefined`.

0.1.4 исправляет обе проблемы:

- больше не monkey-patch'ит функции `scope-docs`;
- наблюдает фактическое состояние Commando и штатный `#doc-preview`;
- получает CIX entry id из выбранного результата вида `co-result-item-doc-281578`;
- ждёт, пока заголовок штатного viewer совпадёт с выбранным символом;
- вызывает `koScopeDocs.info(entry_id)`;
- если `doc` пустой, запускает локальный `Pod::Perldoc`;
- для функции сначала пробует `perldoc -f SYMBOL`, затем POD содержащего модуля;
- перед загрузкой CommonJS-модулей ждёт регистрации `koScopeDocs` до 15 секунд, поэтому больше не зависит от порядка запуска add-on'ов;
- `koScopeDocs` запрашивается лениво и не может уронить модуль при загрузке.

Для `_check_unique` ожидаемая цепочка:

```text
CIX: doc = NULL
  -> perldoc -f _check_unique
  -> miss
  -> perldoc AutoSplit
  -> секция "Perldoc — AutoSplit"
```

### Диагностика

Подробный лог:

```text
~/.komodoide/9.3/XRE/komodo-perldoc-debug.log
```

В нём фиксируются startup/retry, выбранный Commando entry, состояние `#doc-preview`, результат `koScopeDocs.info()`, выбранный Perl, точная команда `Pod::Perldoc`, return code и stdout/stderr.

### Сборка

```sh
./build.sh
```

Результат:

```text
dist/komodo-perldoc-0.1.4.xpi
```

### Smoke test

1. `git pull` и `./build.sh`.
2. Установить `dist/komodo-perldoc-0.1.4.xpi`.
3. Полностью перезапустить Komodo.
4. Открыть Perl-файл → `Documentation` → выбрать `_check_unique`.
5. Штатная сигнатура должна остаться; ниже должна появиться секция `Perldoc — AutoSplit`.
6. Если нет — приложить полный `komodo-perldoc-debug.log`.

---

## English

**Komodo Perldoc** adds a local `perldoc` fallback to Komodo IDE 9.3.x's built-in Documentation browser.

Komodo builds local Perl documentation from CodeIntel CIX. Some entries have a signature but no `doc`, so the stock preview contains only the symbol name and signature. The extension keeps the stock search and does not modify `scope-docs.jar`.

### Version 0.1.4

0.1.3 diagnostics identified two independent problems:

1. normal Commando navigation bypasses the exported `scope-docs/docs.preview()` function, so the previous hook point was wrong;
2. bootstrap add-on startup order is nondeterministic, and `komodo-perldoc` could load before the built-in `scope-docs` registered `@activestate.com/commando/koScopeDocs;1`, causing `Cc[...] is undefined`.

0.1.4 fixes both:

- no longer monkey-patches `scope-docs` functions;
- observes the real Commando selection and stock `#doc-preview`;
- extracts the CIX entry id from stock result ids such as `co-result-item-doc-281578`;
- waits until the rendered heading matches the selected symbol;
- calls `koScopeDocs.info(entry_id)`;
- if CIX `doc` is empty, invokes local `Pod::Perldoc`;
- tries `perldoc -f SYMBOL` first, then falls back to the containing module POD;
- waits up to 15 seconds for the `koScopeDocs` component before loading the extension modules;
- resolves the `koScopeDocs` service lazily, avoiding module-load crashes.

Diagnostics are written to:

```text
~/.komodoide/9.3/XRE/komodo-perldoc-debug.log
```

Build with:

```sh
./build.sh
```

Output:

```text
dist/komodo-perldoc-0.1.4.xpi
```
