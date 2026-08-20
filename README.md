# Komodo Perldoc

[Русский](#русский) · [English](#english)

## Русский

**Komodo Perldoc** — локальный fallback к `perldoc` для встроенного браузера документации Komodo IDE 9.3.x.

В Komodo 9.3.x scope `Documentation` строит локальную документацию по Perl из CodeIntel CIX. У многих символов в CIX есть сигнатура, но нет атрибута `doc`, поэтому штатная панель показывает только имя и сигнатуру. Расширение не заменяет поиск CodeIntel и не изменяет `scope-docs.jar`: оно дополняет уже отрисованную штатную страницу только тогда, когда Perl-entry не содержит локальной CIX-документации.

### Версия 0.1.1

- Использует существующий scope `Documentation`, отдельного интерфейса поиска нет.
- Не заменяет штатный viewer: breadcrumbs, сигнатуры, навигация, **Online Documentation** и **Insert Snippet** остаются кодом Komodo.
- Для пустого `doc` вызывает локальный `Pod::Perldoc`.
- Использует `perlDefaultInterpreter` из настроек Komodo; если он не задан, используется `perl` из `PATH`.
- Для функций сначала пробует `perldoc -f SYMBOL`, затем POD содержащего модуля.
- Для переменных пробует `perldoc -v VARIABLE`.
- Кэширует успешные и неуспешные запросы на время жизни окна Komodo.
- Прерывает зависший lookup через 15 секунд.
- Не модифицирует установленную Komodo IDE и `scope-docs.jar`.

### Почему Komodo не просит перезапуск

Расширение объявлено как bootstrap/restartless add-on (`<em:bootstrap>true</em:bootstrap>`). Поэтому Komodo имеет право активировать его сразу после установки и не показывает обязательный запрос на restart. После обновления тестовой версии полный перезапуск всё равно рекомендуется, чтобы исключить старый загруженный JS-модуль из текущего окна.

### Ограничение 0.1.x

Для приватных/модульных функций без собственной записи в `perlfunc`, например `AutoSplit::_check_unique`, показывается POD содержащего модуля (`AutoSplit`), а не автоматически вырезанный раздел именно для функции.

Документация core-функций (`abs` и т. п.) зависит от наличия стандартной Perl-документации (`perlfunc`, `perlop`) в установленном Perl. На Debian/Ubuntu она может поставляться отдельным системным пакетом. POD модулей обычно читается непосредственно из установленных `.pm`.

### Сборка

```sh
./build.sh
```

Скрипт не зависит от текущей рабочей директории. Результат:

```text
dist/komodo-perldoc-0.1.1.xpi
```

### Установка

Откройте менеджер дополнений Komodo → **Install Add-on From File** → выберите `komodo-perldoc-0.1.1.xpi`.

Для чистого теста после обновления 0.1 → 0.1.1 полностью перезапустите Komodo.

### Smoke test

1. Открыть Perl-файл и вызвать **Documentation: Open documentation for Current Language**.
2. Найти `_check_unique` из `AutoSplit`.
3. Штатная сигнатура должна остаться на месте, а ниже должен появиться раздел `Perldoc — AutoSplit` с локальным POD.
4. Для записи с уже заполненным CIX `doc` расширение не должно ничего добавлять.
5. Проверить **Online Documentation** и **Insert Snippet** — они должны работать штатно.

Диагностика пишется в логгеры `komodo-perldoc`, `komodo-perldoc-viewer` и `komodo-perldoc-runner`.

---

## English

**Komodo Perldoc** is a local `perldoc` fallback for the built-in Documentation browser in Komodo IDE 9.3.x.

Komodo 9.3.x builds its local Perl Documentation scope from CodeIntel CIX files. Many CIX symbols contain a signature but no `doc` attribute, so the stock preview can contain only the name and signature. The extension keeps CodeIntel search and the stock viewer intact and augments the rendered page only when a Perl entry has no local CIX documentation.

### Version 0.1.1

- Hooks the existing `Documentation` scope; there is no separate search UI.
- Keeps the stock viewer, breadcrumbs, signatures, navigation, **Online Documentation**, and **Insert Snippet**.
- Uses local `Pod::Perldoc` only when CIX `doc` is empty.
- Uses Komodo's `perlDefaultInterpreter` preference when set, otherwise `perl` from `PATH`.
- Tries `perldoc -f SYMBOL` for function entries and then falls back to the containing module POD.
- Tries `perldoc -v VARIABLE` for variable entries.
- Caches successful and failed lookups for the Komodo window lifetime.
- Times out a stuck lookup after 15 seconds.
- Does not modify the Komodo installation or `scope-docs.jar`.

### Why Komodo does not request a restart

The extension is a bootstrap/restartless add-on (`<em:bootstrap>true</em:bootstrap>`). Komodo may activate it immediately after installation and therefore does not have to show a mandatory restart prompt. A full restart is still recommended after upgrading a test build so no old JavaScript module remains loaded in the current window.

### 0.1.x limitation

For private/module functions without their own `perlfunc` entry, such as `AutoSplit::_check_unique`, the extension displays the containing module POD (`AutoSplit`) instead of extracting an exact function-specific POD section.

Core-function documentation such as `abs` depends on the selected Perl installation containing the standard `perlfunc`/`perlop` documentation. On Debian/Ubuntu that documentation can be packaged separately. Module POD is normally read directly from the installed `.pm` file.

### Build

```sh
./build.sh
```

The script is independent of the current working directory. Output:

```text
dist/komodo-perldoc-0.1.1.xpi
```

### Install

Open Komodo's Add-ons Manager → **Install Add-on From File** → select `komodo-perldoc-0.1.1.xpi`.

For a clean 0.1 → 0.1.1 test, fully restart Komodo after upgrading.

### Smoke test

1. Open a Perl file and invoke **Documentation: Open documentation for Current Language**.
2. Search for `_check_unique` from `AutoSplit`.
3. The stock signature should remain visible and a `Perldoc — AutoSplit` section should appear below it.
4. Entries that already contain CIX `doc` must remain untouched.
5. Verify that **Online Documentation** and **Insert Snippet** still behave normally.

Diagnostics are written through the `komodo-perldoc`, `komodo-perldoc-viewer`, and `komodo-perldoc-runner` loggers.
