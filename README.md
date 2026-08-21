# Komodo Perldoc

[Русский](#русский) · [English](#english)

## Русский

**Komodo Perldoc** — локальный fallback к `perldoc` для встроенного браузера документации Komodo IDE 9.3.x.

Komodo строит Perl-документацию из CodeIntel CIX. У части символов есть сигнатура, но нет `doc`; расширение сохраняет штатный поиск и viewer, а для таких записей добавляет локальный POD через выбранный в Komodo Perl.

### Версия 0.2.0

0.1.10 закрыла инфраструктурный этап: restart-required XUL overlay, событийный monitor, mouse preview, `Perl (1)`, `Classes`/`Properties`, локальный `Pod::Perldoc` fallback и cache.

0.2.0 добавляет первый новый функциональный слой: **документацию конкретного символа внутри POD модуля**.

Для пустого CIX `doc` цепочка теперь такая:

```text
CIX entry
  -> builtin/variable lookup: perldoc -f SYMBOL / -v SYMBOL
  -> symbol POD в наиболее конкретном содержащем модуле
  -> symbol POD в POD родительского модуля, только если owner совпадает
  -> полный POD наиболее конкретного модуля
  -> полный POD родительского модуля
```

Экстрактор:

- использует тот же Perl и тот же `@INC`, что и обычный `perldoc`;
- не `require`/`use`-ит целевой модуль, поэтому не запускает его код;
- ищет подходящие `=head1..4` и `=item`;
- понимает заголовки вида `address`, `$obj->address()` и `HTML::Element::address()`;
- рендерит только найденный POD-блок через `Pod::Simple::Text`;
- проверяет owner для квалифицированных методов, чтобы, например, не выдать `CPAN::Module::userid()` за выбранный `CPAN::Index::userid`;
- при отсутствии подходящей секции молча продолжает старый fallback к полному модулю.

Практические ожидаемые результаты:

```text
HTML::Element::address
  -> perldoc -f address: miss
  -> symbol POD HTML::Element::address: success
  -> Perldoc — HTML::Element::address
```

Вместо ~58 КБ всего `HTML::Element` показывается только секция `=head2 address`.

```text
AutoSplit::autosplit
  -> perldoc -f autosplit: miss
  -> symbol POD AutoSplit::autosplit: miss
  -> полный AutoSplit: success
```

У `AutoSplit` отдельной POD-секции для `autosplit` нет, поэтому поведение остаётся совместимым с 0.1.10.

Для `CPAN::Index::userid` секция `CPAN::Module::userid()` в общем POD `CPAN` специально считается несовпадением owner и не используется как ложный результат.

### Сохранённые исправления 0.1.x

- событийный monitor без постоянного polling;
- одиночный click по результату Documentation обновляет preview;
- `Perl (1)` возвращает в текущий Perl-subscope; `Esc` штатно поднимает на список языков;
- `Classs -> Classes`, `Propertys -> Properties`;
- обычный локальный miss не показывает сырой stderr;
- classic XUL overlay: установка/обновление требуют restart;
- `scope-docs.jar` и системные файлы Komodo не изменяются.

### Диагностика

```text
~/.komodoide/9.3/XRE/komodo-perldoc-debug.log
```

Для нового lookup в логе видны кандидаты `kind:"symbol"`, `module`, `owner`, `symbol`, результат экстрактора и последующий fallback.

### Сборка

```sh
./build.sh
```

Результат:

```text
dist/komodo-perldoc-0.2.0.xpi
```

### Smoke test 0.2.0

1. Установить `dist/komodo-perldoc-0.2.0.xpi` и перезапустить Komodo по запросу Add-on Manager.
2. `Documentation -> Perl`, найти `address` из `HTML::Element`.
3. Ожидается `Perldoc — HTML::Element::address` и только описание метода `address`, а не весь модуль.
4. Проверить `URI::URL::address`: если отдельной POD-секции нет, должен сработать старый fallback `Perldoc — URI::URL`.
5. Проверить `AutoSplit::autosplit` и `_check_unique`: полный `Perldoc — AutoSplit` должен остаться рабочим fallback.
6. Проверить `Perl (1)` и переключение результатов mouse click на предмет регрессий.

---

## English

**Komodo Perldoc** adds a local `perldoc` fallback to Komodo IDE 9.3.x's built-in Documentation browser while preserving stock search and navigation.

### Version 0.2.0

0.2.0 adds **symbol-level POD extraction** before the existing full-module fallback.

Lookup order for a CIX entry with empty `doc`:

```text
perlfunc/perlvar lookup
  -> symbol POD in the most specific containing module
  -> owner-safe symbol POD in parent module documentation
  -> full containing-module POD
  -> full parent-module POD
```

The extractor uses the configured Perl's `@INC`, does not load the target module, recognizes POD headings/items for the selected symbol, renders the matching block via `Pod::Simple::Text`, and rejects qualified sections belonging to another owner/class.

Example: `HTML::Element::address` now renders only the `address` section rather than the entire `HTML::Element` manual. If no symbol section exists (for example `AutoSplit::autosplit` in the tested Perl), the previous full-module fallback remains unchanged.

All 0.1.10 navigation/compatibility fixes remain in place.

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
dist/komodo-perldoc-0.2.0.xpi
```
