# Komodo Perldoc

[Русский](#русский) · [English](#english)

## Русский

**Komodo Perldoc** — локальный fallback к `perldoc` для встроенного браузера документации Komodo IDE 9.3.x.

В Komodo 9.3.x scope `Documentation` строит локальную документацию по Perl из CodeIntel CIX. У многих символов в CIX есть сигнатура, но нет атрибута `doc`, поэтому штатная панель показывает только имя и сигнатуру. Расширение не заменяет поиск CodeIntel и не изменяет `scope-docs.jar`: оно дополняет уже отрисованную штатную страницу только тогда, когда Perl-entry не содержит локальной CIX-документации.

### Версия 0.1.2

- Использует существующий scope `Documentation`, отдельного интерфейса поиска нет.
- Не заменяет штатный viewer и больше не перехватывает `onPreviewReady`: breadcrumbs, сигнатуры, навигация, **Online Documentation** и **Insert Snippet** остаются кодом Komodo.
- Перехватывает только вызов `docs.preview()` для запоминания выбранного CIX entry, затем ждёт, пока штатный viewer полностью отрисует соответствующий `#doc-preview`.
- Для пустого Perl `doc` вызывает локальный `Pod::Perldoc` и добавляет секцию `Perldoc — ...` в уже готовый штатный preview.
- Использует `perlDefaultInterpreter` из настроек Komodo; если он не задан, используется `perl` из `PATH`.
- Для функций сначала пробует `perldoc -f SYMBOL`, затем POD содержащего модуля.
- Для переменных пробует `perldoc -v VARIABLE`.
- Кэширует успешные и неуспешные запросы на время жизни окна Komodo.
- Прерывает зависший lookup через 15 секунд.
- Не модифицирует установленную Komodo IDE и `scope-docs.jar`.

### Диагностика 0.1.2

В этой тестовой версии ключевые точки намеренно пишутся на уровне WARNING, чтобы они были видны в `pystderr.log` без изменения log level:

```text
Komodo Perldoc 0.1.2 loaded
Komodo Perldoc 0.1.2 bootstrap loaded into Komodo window
Komodo Perldoc: empty CIX doc for ...; starting local lookup
```

Если ни одной из первых двух строк после запуска нет, проблема находится на уровне загрузки add-on. Если первые две есть, но третьей нет после выбора `_check_unique`, проблема находится в hook/получении CIX entry. Если третья есть, но секция не появилась, проблема уже локализована в ожидании viewer или запуске `Pod::Perldoc`.

### Почему Komodo не просит перезапуск

Расширение объявлено как bootstrap/restartless add-on (`<em:bootstrap>true</em:bootstrap>`), как и встроенный `scope-docs`. Поэтому Komodo может активировать его сразу после установки и не обязан показывать обязательный запрос на restart. После обновления тестовой версии полный перезапуск всё равно рекомендуется, чтобы исключить старый загруженный JS-модуль из текущего окна.

### Ограничение 0.1.x

Для приватных/модульных функций без собственной записи в `perlfunc`, например `AutoSplit::_check_unique`, показывается POD содержащего модуля (`AutoSplit`), а не автоматически вырезанный раздел именно для функции.

Документация core-функций (`abs` и т. п.) зависит от наличия стандартной Perl-документации (`perlfunc`, `perlop`) в установленном Perl. На Debian/Ubuntu она может поставляться отдельным системным пакетом. POD модулей обычно читается непосредственно из установленных `.pm`.

### Сборка

```sh
./build.sh
```

Скрипт не зависит от текущей рабочей директории. Результат:

```text
dist/komodo-perldoc-0.1.2.xpi
```

### Установка и smoke test

1. Установить `komodo-perldoc-0.1.2.xpi` через **Install Add-on From File**.
2. Для чистого теста полностью перезапустить Komodo.
3. Проверить в логе две строки загрузки `Komodo Perldoc 0.1.2 ... loaded`.
4. Открыть Perl-файл → `Documentation` → выбрать `_check_unique` из `AutoSplit`.
5. Штатная сигнатура должна остаться на месте, а ниже должен появиться раздел `Perldoc — AutoSplit` с локальным POD.
6. Для записи с уже заполненным CIX `doc` расширение ничего не добавляет.
7. **Online Documentation** и **Insert Snippet** должны работать штатно.

---

## English

**Komodo Perldoc** is a local `perldoc` fallback for the built-in Documentation browser in Komodo IDE 9.3.x.

Komodo 9.3.x builds its local Perl Documentation scope from CodeIntel CIX files. Many CIX symbols contain a signature but no `doc` attribute, so the stock preview can contain only the name and signature. The extension keeps CodeIntel search and the stock viewer intact and augments the rendered page only when a Perl entry has no local CIX documentation.

### Version 0.1.2

- Hooks the existing `Documentation` scope; there is no separate search UI.
- Does not replace the stock viewer and no longer wraps `onPreviewReady`; breadcrumbs, signatures, navigation, **Online Documentation**, and **Insert Snippet** remain stock Komodo behavior.
- Wraps only `docs.preview()` to remember the selected CIX entry, then waits until Komodo has rendered the matching `#doc-preview`.
- For an empty Perl `doc`, invokes local `Pod::Perldoc` and appends a `Perldoc — ...` section to the already-rendered stock page.
- Uses Komodo's `perlDefaultInterpreter` preference when set, otherwise `perl` from `PATH`.
- Tries `perldoc -f SYMBOL` for function entries and then falls back to the containing module POD.
- Tries `perldoc -v VARIABLE` for variable entries.
- Caches successful and failed lookups for the Komodo window lifetime.
- Times out a stuck lookup after 15 seconds.
- Does not modify the Komodo installation or `scope-docs.jar`.

### 0.1.2 diagnostics

This test build deliberately logs its key checkpoints at WARNING level so they are visible in `pystderr.log` without changing logger configuration:

```text
Komodo Perldoc 0.1.2 loaded
Komodo Perldoc 0.1.2 bootstrap loaded into Komodo window
Komodo Perldoc: empty CIX doc for ...; starting local lookup
```

If neither of the first two messages is present after startup, the problem is add-on loading. If they are present but the third message does not appear after selecting `_check_unique`, the problem is the preview hook/CIX entry path. If the third message appears but the Perldoc section does not, the failure is narrowed to stock-preview readiness or the local `Pod::Perldoc` runner.

### Why Komodo does not request a restart

The extension is a bootstrap/restartless add-on (`<em:bootstrap>true</em:bootstrap>`), like the built-in `scope-docs` extension. Komodo can therefore activate it immediately without a mandatory restart prompt. A full restart is still recommended between test builds to eliminate stale JavaScript modules.

### 0.1.x limitation

For private/module functions without their own `perlfunc` entry, such as `AutoSplit::_check_unique`, the extension displays the containing module POD (`AutoSplit`) instead of extracting an exact function-specific POD section.

Core-function documentation such as `abs` depends on the selected Perl installation containing the standard `perlfunc`/`perlop` documentation. On Debian/Ubuntu that documentation can be packaged separately. Module POD is normally read directly from the installed `.pm` file.

### Build

```sh
./build.sh
```

The script is independent of the current working directory. Output:

```text
dist/komodo-perldoc-0.1.2.xpi
```

### Install and smoke test

1. Install `komodo-perldoc-0.1.2.xpi` with **Install Add-on From File**.
2. Fully restart Komodo for a clean test.
3. Confirm that the two `Komodo Perldoc 0.1.2 ... loaded` messages are present in the log.
4. Open a Perl file → `Documentation` → select `_check_unique` from `AutoSplit`.
5. The stock signature should remain visible and a `Perldoc — AutoSplit` section should appear below it.
6. Entries that already contain CIX `doc` remain untouched.
7. **Online Documentation** and **Insert Snippet** must continue to behave normally.
