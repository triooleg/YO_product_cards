# YOleotard Product Card Enhancer

WordPress-плагин для сайта YOleotard, который переносит фронтенд-логику карточек товара из разрозненных вставок в управляемый плагин.

Плагин добавляет в карточки товара:

- кнопку скидки на основе CSS-класса вида `sale10`, `sale30`, `sale50`;
- конвертацию цены из EUR в выбранную валюту;
- переключение размеров из сантиметров в дюймы;
- сопоставление карточек с Google Shopping feed и назначение `id` карточке товара;
- админ-страницу WordPress для включения/отключения модулей и настройки селекторов.
- дополнительные услуги Ready-to-Wear и popup уменьшения размеров до 4 cm.

Текущая версия: **1.1.7**. Подробности новой функции и контракт Checkout: [Персонализация](docs/PERSONALIZATION.md).
Оплата услуг требует следующего этапа интеграции Checkout: текущая версия готовит выбор и отображает предварительный итог.

Важно: в текущем коде URL фида по умолчанию указывает на `https://www.yoleotard.com/?yoleotard_google_feed=1`. Если рабочий публичный домен проекта должен быть `https://yoloetard.com`, это нужно отдельно синхронизировать в настройках плагина и в коде по умолчанию.

## Структура проекта

```text
yoleotard-product-card-enhancer/
  yoleotard-product-card-enhancer.php  # основной файл плагина WordPress
  assets/css/frontend.css              # стили для sale-кнопок и бейджа скидки
  assets/js/frontend.js                # валюты, cm/in, скидки, фид и общий API
  assets/js/personalization.js          # услуги, popup, состояние и контракт Checkout
ORCHESTRATOR.md                        # правила дальнейшей разработки
.agents/                               # роли специализированных агентов
```

## Как работает плагин

### 1. PHP-слой

Файл `yoleotard-product-card-enhancer.php`:

- регистрирует WordPress-плагин `YOleotard Product Card Enhancer` версии `1.1.7`;
- подключает CSS и JS на фронтенде через `wp_enqueue_scripts`;
- передает настройки в браузер через `wp_localize_script` в объект `YOProductCardEnhancerSettings`;
- добавляет страницу настроек `Settings -> YO Product Cards`;
- хранит настройки в опции WordPress `yo_pce_settings`;
- санитизирует URL, цвета, чекбоксы, валюты, CSS-селекторы и текстовые поля.

### 2. Конвертация валют

Базовая цена берется из элементов с атрибутом `data-eur`, например:

```html
<span class="yo-price" data-eur="45">45 EUR</span>
```

JS получает курсы через NBU API:

```text
https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json
```

Курсы кэшируются в `localStorage` на один календарный день. EUR остается базовой валютой, остальные валюты пересчитываются через UAH-кросс-курс.

Поддерживаемые валюты по умолчанию:

- EUR
- USD
- GBP
- MYR
- PLN
- AUD

Формат валют редактируется в админке в виде строк:

```text
CODE|symbol|before/after|label
```

### 3. Конвертация размеров

Размеры ищутся по селектору `.yo-measure[data-cm]`.

Пример:

```html
<span class="yo-measure" data-cm="120-130">120-130</span>
```

Кнопки переключения должны находиться внутри блока `.yo-unit-toggle` и иметь `data-unit="cm"` или `data-unit="in"`.

Коэффициент по умолчанию: `1 inch = 2.54 cm`.

### 4. Sale-кнопки

Плагин ищет элементы с CSS-классом, который начинается с настроенного префикса `sale` и заканчивается числом.

Примеры:

```text
sale10
sale25
sale50
```

Число трактуется как скидка в EUR. Если карточка содержит кнопку покупки и цену, плагин:

- оставляет старую кнопку, но делает ее перечеркнутой;
- создает новую кнопку покупки с новой ценой;
- добавляет бейдж скидки;
- сохраняет совместимость с UIkit-классами кнопок.

### 5. Google Shopping feed ID matching

Плагин загружает XML-фид, извлекает title/link товаров, нормализует slug и пытается сопоставить карточку на странице с товаром из фида. При успешном совпадении карточке задаются:

```js
card.id = matched.slug;
card.dataset.feedId = matched.slug;
```

Это помогает якорям, аналитике, внутренним ссылкам и последующей автоматизации.

## Админ-настройки

В WordPress доступна страница:

```text
Settings -> YO Product Cards
```

Вкладки:

- `General` - включение плагина и отдельных модулей;
- `Currency` - URL курсов, ключ кэша, список валют;
- `Selectors` - CSS-селекторы карточек, цены, размеров, кнопок;
- `Sale buttons` - префикс скидки, тексты кнопок, цвета бейджа;
- `Feed IDs` - URL Google-фида и правила очистки slug.
- `Product personalization` - включение услуг и их цены в EUR.

## Минимальные требования к HTML карточки

Для цены:

```html
<span class="yo-price" data-eur="45">45 EUR</span>
```

Для размера:

```html
<span class="yo-measure" data-cm="120-130">120-130</span>
```

Для переключателя единиц:

```html
<div class="yo-unit-toggle">
  <button data-unit="cm">cm</button>
  <button data-unit="in">in</button>
</div>
```

Для скидки:

```html
<div class="el-item sale10">
  ...
</div>
```

## Локальная проверка перед публикацией

```powershell
php -l yoleotard-product-card-enhancer\yoleotard-product-card-enhancer.php
node --check yoleotard-product-card-enhancer\assets\js\frontend.js
node tests\frontend-sale-button-labels.test.js
npm test
php tests\settings.test.php
git diff --check
```

Живая проверка на сайте должна выполняться отдельно после установки/обновления плагина в WordPress. Локальные проверки подтверждают синтаксис и структуру, но не подтверждают работу на реальной теме, UIkit-разметке и актуальном фиде.

## Архив для установки и обновления

Чтобы WordPress обновлял уже установленный плагин, а не ставил новый, ZIP должен содержать одну верхнюю папку с тем же slug:

```text
yoleotard-product-card-enhancer/
  yoleotard-product-card-enhancer.php
  assets/
```

Архив собирается командой:

```powershell
python tools\package-plugin.py
```

Готовый файл:

```text
plugin-archives/yoleotard-product-card-enhancer.zip
```

Скрипт сохраняет предыдущий ZIP рядом с timestamp в имени, затем пересобирает основной архив и проверяет структуру: одна верхняя папка, без Windows-разделителей `\`, с обязательными PHP/JS/CSS файлами.

## Следующие рекомендуемые улучшения

- Исправить доменную неоднозначность `yoloetard.com` / `yoleotard.com`, если это не опечатка.
- Добавить smoke-тесты на DOM-логику через фиктивную HTML-карточку.
- Вынести JS-модули по зонам ответственности: currency, units, sale, feed.
- Добавить безопасный fallback, если NBU API недоступен.
