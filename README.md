# Komodo Perldoc

[Русский](#русский) · [English](#english)

## Русский

**Komodo Perldoc** — локальный fallback к `perldoc` для встроенного браузера документации Komodo IDE 9.3.x.

В Komodo 9.3.x scope `Documentation` строит локальную документацию по Perl из CodeIntel CIX. У многих символов в CIX есть сигнатура, но нет атрибута `doc`, поэтому штатная панель показывает только имя и сигнатуру. Расширение не заменяет поиск CodeIntel и не изменяет `scope-docs.jar`: оно должно дополнять штатную страницу только тогда, когда Perl-entry не содержит CIX-документации.

### Версия 0.1.3

0.1.2 доказала важную вещь: add-on загружается, `scope-docs/docs` доступен и wrapper на экспортируемый `docs.preview()` успешно устанавливается, однако реальная навигация Commando до него не доходит. Значит, проблема находится в неверно выбранной точке hook-а, а не в установке XPI или запуске bootstrap.

0.1.3 оставляет прежний hook как дополнительный сигнал, но добавляет **независимый диагностический probe**, который не зависит от вызова `docs.preview()`:

- перечисляет экспортируемые функции `scope-docs/docs` и `commando/commando`;
- отслеживает `click`, `command`, `dblclick`, `keydown` в результатах Commando;
- отслеживает смену scope/subscope, поисковой строки и выбранного результата;
- ставит `MutationObserver` на `#commando-preview`;
- фиксирует появление/замену браузера `#doc-preview`, его `src`, `readyState` и URL;
- снимает текст `#wrapper`, заголовок документации и атрибуты ссылок (`index`, `link-index`, `href`);
- продолжает подробную трассировку CIX lookup, Perl interpreter, цепочки `perldoc -f` / module fallback, `RunAsync`, return code, stdout/stderr и кэша, если до runner-а дойдёт выполнение.

Все диагностические сообщения одновременно пишутся в Mozilla Console Service и в отдельный файл:

```text
~/.komodoide/9.3/XRE/komodo-perldoc-debug.log
```

Файл начинается заново при каждом `startup()` расширения.

### Сборка

```sh
./build.sh
```

Скрипт не зависит от текущей рабочей директории. Результат:

```text
dist/komodo-perldoc-0.1.3.xpi
```

### Диагностический прогон

1. Установить `komodo-perldoc-0.1.3.xpi` через **Install Add-on From File**.
2. Полностью перезапустить Komodo.
3. Открыть Perl-файл → `Documentation`.
4. Перейти `Perl → AutoSplit → AutoSplit → _check_unique`, как в предыдущем тесте.
5. Сохранить полный лог:

```sh
cat ~/.komodoide/9.3/XRE/komodo-perldoc-debug.log
```

Для 0.1.3 важен **весь файл**, а не только строки с ошибками: по нему должна быть видна фактическая цепочка событий, которая создаёт штатный viewer и обходит `docs.preview()`.

### Почему Komodo не просит перезапуск

Расширение объявлено как bootstrap/restartless add-on (`<em:bootstrap>true</em:bootstrap>`), как и встроенный `scope-docs`. Поэтому Komodo может активировать его сразу после установки и не обязан показывать обязательный запрос на restart. Между тестовыми версиями полный перезапуск всё равно рекомендуется, чтобы исключить старые CommonJS-модули из памяти.

---

## English

**Komodo Perldoc** is a local `perldoc` fallback for the built-in Documentation browser in Komodo IDE 9.3.x.

Komodo 9.3.x builds its local Perl Documentation scope from CodeIntel CIX files. Many CIX symbols contain a signature but no `doc` attribute, so the stock preview may contain only the name and signature. The extension keeps CodeIntel search intact and does not modify `scope-docs.jar`.

### Version 0.1.3

0.1.2 established an important fact: the add-on loads correctly, `scope-docs/docs` is available, and the exported `docs.preview()` function is successfully wrapped, but real Commando navigation does not call that wrapper. The remaining problem is therefore the hook point, not XPI installation or bootstrap startup.

0.1.3 keeps the previous wrapper as an additional signal and adds an **independent diagnostic probe** that does not depend on `docs.preview()` being called:

- records the exported API shapes of `scope-docs/docs` and `commando/commando`;
- traces `click`, `command`, `dblclick`, and `keydown` events in Commando results;
- traces scope/subscope/search/selection changes;
- observes mutations under `#commando-preview`;
- records creation/replacement of `#doc-preview`, its `src`, URL and `readyState`;
- records rendered `#wrapper` text, headings and link attributes (`index`, `link-index`, `href`);
- retains detailed CIX lookup and local `Pod::Perldoc` runner diagnostics if execution reaches that stage.

Diagnostics are written both to Mozilla Console Service and to:

```text
~/.komodoide/9.3/XRE/komodo-perldoc-debug.log
```

The trace file is reset on every add-on `startup()`.

### Build

```sh
./build.sh
```

Output:

```text
dist/komodo-perldoc-0.1.3.xpi
```

### Diagnostic run

1. Install `komodo-perldoc-0.1.3.xpi` with **Install Add-on From File**.
2. Fully restart Komodo.
3. Open a Perl file and open `Documentation`.
4. Navigate `Perl → AutoSplit → AutoSplit → _check_unique` exactly as in the previous test.
5. Capture the complete trace:

```sh
cat ~/.komodoide/9.3/XRE/komodo-perldoc-debug.log
```

For 0.1.3 the **entire file** is useful: it should reveal the actual event/rendering path that creates the stock Documentation viewer while bypassing the exported `docs.preview()` function.
