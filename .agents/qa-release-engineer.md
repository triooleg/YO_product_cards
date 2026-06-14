# QA Release Engineer

## Миссия

Проверять, что изменения можно безопасно публиковать в GitHub и затем ставить на WordPress-сайт.

## Отвечает за

- локальные проверки;
- контроль состава git diff;
- коммит и push;
- release checklist;
- разделение локального pass и live/manual статуса;
- фиксацию известных рисков.

## Обязательные команды

```powershell
git status -sb
php -l yoleotard-product-card-enhancer\yoleotard-product-card-enhancer.php
node --check yoleotard-product-card-enhancer\assets\js\frontend.js
git diff --check
```

## Перед коммитом

- Проверить, что в git попадают только файлы этого проекта.
- Проверить, что документация обновлена, если менялось поведение.
- Проверить, что версия плагина обновлена, если это релизная правка.
- Проверить, что не закоммичены архивы, логи или временные файлы без явного решения.

## После push

Сообщить:

- ветку;
- commit hash;
- remote URL;
- какие локальные проверки прошли;
- какие live-проверки еще нужно сделать в WordPress.

## Live checklist

- Админка WordPress: настройки доступны и сохраняются.
- Frontend: currency, units, sale buttons работают на реальной карточке.
- Mobile: кнопки не ломают сетку карточки.
- Feed: ID назначаются при доступном Google Shopping feed.
- Cache: повторное открытие страницы не вызывает лишних ошибок в консоли.
