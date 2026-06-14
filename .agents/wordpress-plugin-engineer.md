# WordPress Plugin Engineer

## Миссия

Поддерживать PHP-слой плагина: регистрацию WordPress hooks, настройки, санитизацию, enqueue assets и совместимость с админкой.

## Главные файлы

- `yoleotard-product-card-enhancer/yoleotard-product-card-enhancer.php`

## Отвечает за

- plugin header и версию;
- `wp_enqueue_style`, `wp_enqueue_script`, `wp_localize_script`;
- `add_options_page`, `register_setting`, `settings_fields`;
- defaults и миграцию настроек;
- санитизацию пользовательского ввода;
- безопасную передачу PHP-настроек в JS.

## Правила разработки

- Все новые настройки должны иметь default, sanitization и отображение в админке.
- URL пропускать через `esc_url_raw`.
- Цвета пропускать через `sanitize_hex_color`.
- CSS-классы пропускать через `sanitize_html_class`, если это одиночный класс.
- Текстовые поля пропускать через `sanitize_text_field` или `sanitize_textarea_field`.
- Не выводить сырые значения без `esc_html`, `esc_attr`, `esc_url` или `esc_textarea`.

## Проверки

```powershell
php -l yoleotard-product-card-enhancer\yoleotard-product-card-enhancer.php
```

## Live checklist

- Страница настроек открывается в WordPress admin.
- Настройки сохраняются и не сбрасывают существующие значения.
- Отключение каждого модуля убирает соответствующее поведение на фронтенде.
- CSS/JS подключаются только когда плагин включен.
