# Съёмка скриншотов для кейса HR Automotive

Скрипты, которыми сняты картинки в `images/hr-automotive/`. Нужны, чтобы повторить или дополнить
съёмку на любом ПК. Требуется Node 22+ (встроенные `fetch` и `WebSocket`), Google Chrome и Python с
Pillow (`pip install pillow`). Если Chrome стоит не по обычному пути, задайте `CHROME_PATH`.

Пароли в скриптах не хранятся и не вводятся: в админку входит человек сам.

## Публичный сайт (вход не нужен)

```bash
# первый экран и вся страница на ПК (1440), планшете (820), телефоне (390)
node tools/screenshots/capture-public.js https://hr-automotive.aigrus.ru/ tools/screenshots/_work site
python tools/screenshots/build_images.py webp tools/screenshots/_work

# те же блоки по отдельности: coords заголовков + нарезка
node tools/screenshots/capture-sections.js tools/screenshots/_work
python tools/screenshots/build_images.py cut tools/screenshots/_work
```

Скрипты ждут конец прелоадера, принимают баннер cookie, прокручивают страницу (подгружаются ленивые
картинки) и только потом снимают. Полоса прокрутки сайта (15 px) обрезается при сохранении.

## Админка (вход нужен, делает человек)

1. Запустить Chrome с отладочным портом и чистым профилем, открыть страницу входа:
   ```bash
   chrome --remote-debugging-port=9334 --user-data-dir="%TEMP%\hr-admin" https://hr-automotive.aigrus.ru/admin/login
   ```
2. В этом окне самому ввести логин и пароль.
3. Снять разделы: `node tools/screenshots/capture-admin.js`.
   Скрипт только смотрит: переходит по пунктам меню, нажимает «Редактировать» (открывает форму, не
   сохраняет) и «Корзина» (открывает список). «Сохранить», «В корзину», «Удалить», «Восстановить»,
   «Выше/Ниже» и переключатель публикации он не трогает никогда.
4. Метрики с раскрытыми списками: `node tools/screenshots/capture-metrics.js`.
5. Метка на карте до и после клика (без сохранения): `node tools/screenshots/capture-map-move.js`.
6. Закрыть окно Chrome и выйти кнопкой «Выйти». Профиль временный, после закрытия вход пропадает.

Снимки разделов с данными складываются в `tools/screenshots/private/` (в `.gitignore`), остальные в
`images/hr-automotive/`.

## Что ещё не сделано

На экранах «Корзина», «Роли» и «Метрики» видны названия снятых вакансий, логины и IP посетителей.
Поэтому их вкладки на странице скрыты (`PENDING` в `js/hr.js`), а снимки в репозиторий не кладутся.
Чтобы вернуть: перед съёмкой заменить эти данные в самой странице (скрипт-правка текста через
`Runtime.evaluate`: IPv4 по регулярному выражению, логины и названия вакансий в корзине на заглушки),
снять, положить в `images/hr-automotive/` под именами из `js/hr.js` (`admin-trash-*`,
`admin-users-*`, `admin-metrics-*`) и убрать имя из `PENDING`. Селекторы элементов для замены нужно
посмотреть на странице: готового кода маскирования пока нет.
