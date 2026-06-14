# Оркестратор разработки YOleotard Product Card Enhancer

Этот документ задает порядок работы над WordPress-плагином `YOleotard Product Card Enhancer` и распределяет зоны ответственности между агентами. Его цель - чтобы дальнейшая разработка шла управляемо: сначала контекст и риск, затем маленькая правка, затем проверка, затем публикация.

## Цель проекта

Плагин должен надежно управлять улучшениями карточек товара на сайте YOleotard:

- показывать скидочные кнопки в карточках товара;
- конвертировать цены из EUR в выбранные валюты;
- конвертировать размеры из сантиметров в дюймы;
- связывать карточки с товарами из Google Shopping feed;
- давать владельцу сайта настройки через WordPress admin без правки кода.

## Текущее состояние

- Основной файл: `yoleotard-product-card-enhancer/yoleotard-product-card-enhancer.php`.
- Фронтенд-логика: `yoleotard-product-card-enhancer/assets/js/frontend.js`.
- Стили: `yoleotard-product-card-enhancer/assets/css/frontend.css`.
- Версия плагина: `1.0.1`.
- Опция настроек WordPress: `yo_pce_settings`.
- Админ-страница: `Settings -> YO Product Cards`.

## Принципы работы

1. Не менять публичное поведение без причины. Плагин завязан на реальную разметку сайта и UIkit-классы.
2. Любую правку начинать с чтения `README.md`, `ORCHESTRATOR.md` и соответствующего файла агента из `.agents/`.
3. Для новых функций сначала описывать, какой HTML/селектор/настройка требуется на сайте.
4. Локальную проверку и живую проверку на WordPress-сайте всегда разделять.
5. Перед публикацией проверять PHP, JS и git diff.
6. Если меняется логика скидок, валют или размеров, проверять обратную совместимость с существующими атрибутами `data-eur`, `data-cm`, `saleXX`.
7. Не удалять настройки администратора без миграционного плана.

## Канонический рабочий цикл

1. Прочитать текущий код и документы.
2. Определить тип задачи: PHP/admin, JS/DOM, CSS/UI, feed/integration, QA/release.
3. Назначить ответственного агента из `.agents/`.
4. Сформулировать короткий план изменения.
5. Внести минимальные изменения.
6. Выполнить локальные проверки.
7. Обновить документацию, если поведение или настройки изменились.
8. Закоммитить и отправить в GitHub.
9. Отдельно отметить, что нужно проверить на живом сайте.

## Роли агентов

### 1. Logic Architect

Файл роли: `.agents/logic-architect.md`

Отвечает за архитектуру, границы модулей, совместимость с WordPress и стратегию изменений.

### 2. WordPress Plugin Engineer

Файл роли: `.agents/wordpress-plugin-engineer.md`

Отвечает за PHP, WordPress hooks, настройки, санитизацию, enqueue assets и совместимость с админкой.

### 3. Frontend DOM Engineer

Файл роли: `.agents/frontend-dom-engineer.md`

Отвечает за `frontend.js`: валюты, размеры, sale-кнопки, фид, DOM-селекторы и устойчивость к разметке темы.

### 4. QA Release Engineer

Файл роли: `.agents/qa-release-engineer.md`

Отвечает за проверки, release checklist, GitHub-публикацию и список живых сценариев для ручной проверки.

## Матрица ответственности

| Зона | Главный агент | Второй проверяющий |
| --- | --- | --- |
| Архитектура и roadmap | Logic Architect | QA Release Engineer |
| WordPress settings/admin | WordPress Plugin Engineer | Logic Architect |
| Currency conversion | Frontend DOM Engineer | QA Release Engineer |
| Unit conversion | Frontend DOM Engineer | QA Release Engineer |
| Sale buttons | Frontend DOM Engineer | WordPress Plugin Engineer |
| Google feed matching | Frontend DOM Engineer | Logic Architect |
| CSS/UI details | Frontend DOM Engineer | QA Release Engineer |
| Release to GitHub | QA Release Engineer | Logic Architect |

## Обязательные локальные проверки

```powershell
php -l yoleotard-product-card-enhancer\yoleotard-product-card-enhancer.php
node --check yoleotard-product-card-enhancer\assets\js\frontend.js
git diff --check
git status -sb
```

## Живые проверки после установки на сайт

Эти проверки нельзя считать выполненными только по локальному запуску:

- В админке WordPress открывается `Settings -> YO Product Cards`.
- Включение/отключение каждого модуля реально влияет на фронтенд.
- Карточка с `sale10` получает старую и новую кнопку.
- Цена в `data-eur` пересчитывается при смене валюты.
- Размеры в `data-cm` переключаются в inches и обратно.
- Фид Google Shopping доступен и ID карточек назначаются корректно.
- На мобильном экране кнопки скидки не ломают карточку товара.

## Известные риски

- Домен в запросе пользователя указан как `yoloetard.com`, а код использует `yoleotard.com`. Перед живым релизом нужно подтвердить правильный домен.
- JS зависит от структуры темы и UIkit-классов. Изменение темы может сломать селекторы.
- Курсы валют зависят от доступности NBU API и `localStorage` браузера.
- Feed matching использует эвристическое сравнение slug/title, поэтому возможны ложные совпадения для похожих товаров.
- Sale-логика трактует число в `saleXX` как фиксированную скидку в EUR, а не процент.

## Ближайший roadmap

1. Добавить release ZIP workflow и правило сохранения предыдущего архива.
2. Разбить `frontend.js` на понятные секции или модули без изменения поведения.
3. Добавить DOM smoke-тесты для currency/units/sale.
4. Подтвердить домен и URL фида.
5. Добавить changelog для версий плагина.
