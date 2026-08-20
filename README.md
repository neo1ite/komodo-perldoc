# Komodo Perldoc

[Русский](#русский) · [English](#english)

## Русский

**Komodo Perldoc** — локальный fallback к `perldoc` для встроенного браузера документации Komodo IDE 9.3.x.

Komodo 9.3.x строит локальный scope `Documentation` по CodeIntel CIX. У многих Perl-символов в CIX есть сигнатура, но нет `doc`, поэтому штатный preview показывает только имя и сигнатуру. Расширение сохраняет штатный поиск CodeIntel и не модифицирует `scope-docs.jar`.

### Версия 0.1.4

Диагностика 0.1.3 локализовала проблему окончательно: add-on загружается, но обычная навигация Commando **не вызывает экспортированный `scope-docs/docs.preview()`**, хотя именно штатный Commando создаёт `#doc-preview` и рендерит нужный CIX entry.

Поэтому 0.1.4 больше вообще не перехватывает функции `scope-docs`. Вместо этого она наблюдает фактическое состояние Commando:

- текущий scope должен быть `Documentation`, subscope — `Perl`;
- выбранный результат берётся из DOM `#commando-results`;
- entry id извлекается из штатного id вида `co-result-item-doc-281578`;
- расширение ждёт полностью отрисованный штатный `#doc-preview`;
- заголовок страницы сверяется с выбранным символом, чтобы не подмешивать документацию при переходе по breadcrumbs;
- затем вызывается штатный `koScopeDocs.info(entry_id)`;
- если `doc` пустой, запускается локальный `Pod::Perldoc` и в готовый штатный viewer добавляется секция `Perldoc — ...`.

Для `_check_unique` ожидаемая цепочка: `perldoc -f _check_unique` → miss → fallback на `AutoSplit` → POD модуля.

Подробная трассировка сохраняется в:

```text
~/.komodoide/9.3/XRE/komodo-perldoc-debug.log
```

В 0.1.4 остаётся и диагностический probe 0.1.3, поэтому лог содержит как production-маршрут `[monitor]`, так и независимые снимки `[probe]`.

### Сборка

```sh
./build.sh
```

Результат:

```text
dist/komodo-perldoc-0.1.4.xpi
```

### Smoke test

1. Установить `komodo-perldoc-0.1.4.xpi` через **Install Add-on From File**.
2. Полностью перезапустить Komodo.
3. Открыть Perl-файл → `Documentation`.
4. Выбрать `_check_unique` из `AutoSplit`.
5. Штатная сигнатура должна остаться на месте; ниже должен появиться `Perldoc — AutoSplit`.
6. Если нет — прислать целиком `~/.komodoide/9.3/XRE/komodo-perldoc-debug.log`.

### Почему Komodo не просит перезапуск

Расширение bootstrap/restartless (`<em:bootstrap>true</em:bootstrap>`), как и встроенный `scope-docs`. Между тестовыми версиями полный restart всё равно рекомендуется для очистки загруженных CommonJS-модулей.

---

## English

**Komodo Perldoc** provides a local `perldoc` fallback for Komodo IDE 9.3.x's built-in Documentation browser.

Komodo builds its Perl Documentation scope from CodeIntel CIX. Many entries have a signature but no `doc`, leaving the stock preview almost empty. The extension keeps the stock CodeIntel search and does not modify `scope-docs.jar`.

### Version 0.1.4

0.1.3 diagnostics established the real integration path: normal Commando navigation does **not** call the exported `scope-docs/docs.preview()` function, even though Commando creates `#doc-preview` and renders the selected CIX entry.

0.1.4 therefore stops wrapping `scope-docs` functions entirely. It observes the actual Commando state instead:

- scope must be `Documentation` and subscope `Perl`;
- the selected result is read from `#commando-results`;
- the CIX entry id is extracted from stock ids such as `co-result-item-doc-281578`;
- the extension waits for the stock `#doc-preview` to finish rendering;
- the rendered heading must match the selected symbol, avoiding stale breadcrumb navigation;
- stock `koScopeDocs.info(entry_id)` supplies the CIX metadata;
- if `doc` is empty, local `Pod::Perldoc` is invoked and a `Perldoc — ...` section is appended to the already-rendered stock viewer.

For `_check_unique`, the intended chain is `perldoc -f _check_unique` → miss → module fallback → `AutoSplit` POD.

Detailed diagnostics are written to:

```text
~/.komodoide/9.3/XRE/komodo-perldoc-debug.log
```

The 0.1.3 probe remains enabled in this test build, so the trace contains both the production `[monitor]` path and independent `[probe]` snapshots.

### Build

```sh
./build.sh
```

Output:

```text
dist/komodo-perldoc-0.1.4.xpi
```

### Smoke test

1. Install `komodo-perldoc-0.1.4.xpi` with **Install Add-on From File**.
2. Fully restart Komodo.
3. Open a Perl file → `Documentation`.
4. Select `_check_unique` from `AutoSplit`.
5. The stock signature should remain visible and `Perldoc — AutoSplit` should appear below it.
6. If not, attach the complete `~/.komodoide/9.3/XRE/komodo-perldoc-debug.log`.
