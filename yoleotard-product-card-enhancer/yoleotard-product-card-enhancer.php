<?php
/**
 * Plugin Name: YOleotard Product Card Enhancer
 * Description: Adds product card enhancements for YOleotard: cm/in switcher, currency conversion, sale buttons, and Google Shopping feed ID matching.
 * Version: 1.1.6
 * Author: YOleotard
 * Text Domain: yoleotard-product-card-enhancer
 */

if (!defined('ABSPATH')) {
    exit;
}

final class YO_Product_Card_Enhancer {
    const OPTION_NAME = 'yo_pce_settings';
    const VERSION = '1.1.6';

    public function __construct() {
        add_action('wp_enqueue_scripts', [$this, 'enqueue_frontend_assets']);
        add_action('admin_menu', [$this, 'add_admin_page']);
        add_action('admin_init', [$this, 'register_settings']);
        add_filter('plugin_action_links_' . plugin_basename(__FILE__), [$this, 'add_settings_link']);
    }

    public static function defaults() {
        return [
            'enabled' => '1',
            'enable_units' => '1',
            'enable_currency' => '1',
            'enable_sale' => '1',
            'enable_feed_ids' => '1',
            'enable_personalization' => '1',
            'enable_size_adaptation' => '1',
            'enable_matching_headpiece' => '1',
            'enable_extra_rhinestones' => '1',
            'size_adaptation_price' => '25',
            'matching_headpiece_price' => '15',
            'extra_rhinestones_price' => '10',
            'cm_per_inch' => '2.54',
            'default_unit' => 'cm',
            'default_currency' => 'EUR',
            'nbu_url' => 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json',
            'feed_url' => 'https://www.yoleotard.com/?yoleotard_google_feed=1',
            'fx_cache_key' => 'yo_fx_nbu_cache_v2',
            'currencies' => "EUR|€|after|€ EUR\nUSD|$|before|$ USD\nGBP|£|before|£ GBP\nMYR|RM |before|RM MYR\nPLN| zł|after|zł PLN\nAUD|A$|before|A$ AUD",
            'extra_currency_options' => "PLN|zł PLN\nAUD|A$ AUD",
            'card_selector' => '.uk-card, article, .el-item, li, .uk-panel, .tm-item, .yoo-item',
            'feed_card_selector' => '.el-item',
            'title_selector' => '.el-title',
            'button_selector' => 'a.el-link.uk-button',
            'price_selector' => '.yo-price[data-eur]',
            'measure_selector' => '.yo-measure[data-cm]',
            'currency_selector' => 'select[data-currency], [data-currency]',
            'unit_toggle_selector' => '.yo-unit-toggle',
            'sale_class_prefix' => 'sale',
            'sale_wrapper_class' => 'sale-wrapper',
            'sale_ready_data' => 'saleReady',
            'old_button_text' => 'Buy',
            'new_button_text' => 'Buy now',
            'sale_new_button_class' => 'uk-button-danger',
            'sale_badge_bg' => '#c00',
            'sale_badge_color' => '#fff',
            'feed_url_path_marker' => 'yoleotard-product',
            'feed_strip_suffix_regex' => '_for_height.*$|_\\d+_\\d+$',
        ];
    }

    public static function get_settings() {
        $saved = get_option(self::OPTION_NAME, []);
        if (!is_array($saved)) {
            $saved = [];
        }
        return wp_parse_args($saved, self::defaults());
    }

    public function enqueue_frontend_assets() {
        $settings = self::get_settings();
        if (empty($settings['enabled'])) {
            return;
        }

        $base_url = plugin_dir_url(__FILE__);

        wp_enqueue_style(
            'yo-product-card-enhancer',
            $base_url . 'assets/css/frontend.css',
            [],
            self::VERSION
        );

        $badge_bg = sanitize_hex_color($settings['sale_badge_bg']) ?: '#c00';
        $badge_color = sanitize_hex_color($settings['sale_badge_color']) ?: '#fff';
        wp_add_inline_style(
            'yo-product-card-enhancer',
            ':root{--yo-sale-badge-bg:' . esc_html($badge_bg) . ';--yo-sale-badge-color:' . esc_html($badge_color) . ';}'
        );

        wp_enqueue_script(
            'yo-product-card-enhancer',
            $base_url . 'assets/js/frontend.js',
            [],
            self::VERSION,
            true
        );

        wp_localize_script('yo-product-card-enhancer', 'YOProductCardEnhancerSettings', $this->frontend_config($settings));
        wp_enqueue_script('yo-product-card-personalization', $base_url . 'assets/js/personalization.js', ['yo-product-card-enhancer'], self::VERSION, true);
    }

    private function frontend_config($settings) {
        return [
            'enabled' => !empty($settings['enabled']),
            'enableUnits' => !empty($settings['enable_units']),
            'enableCurrency' => !empty($settings['enable_currency']),
            'enableSale' => !empty($settings['enable_sale']),
            'enableFeedIds' => !empty($settings['enable_feed_ids']),
            'personalization' => [
                'enabled' => !empty($settings['enable_personalization']),
                'services' => [
                    'size_adaptation' => ['enabled' => !empty($settings['enable_size_adaptation']), 'priceEur' => (float) $settings['size_adaptation_price']],
                    'matching_headpiece' => ['enabled' => !empty($settings['enable_matching_headpiece']), 'priceEur' => (float) $settings['matching_headpiece_price']],
                    'extra_rhinestones' => ['enabled' => !empty($settings['enable_extra_rhinestones']), 'priceEur' => (float) $settings['extra_rhinestones_price']],
                ],
            ],
            'cmPerInch' => (float) $settings['cm_per_inch'],
            'defaultUnit' => sanitize_key($settings['default_unit']),
            'defaultCurrency' => strtoupper(sanitize_text_field($settings['default_currency'])),
            'nbuUrl' => esc_url_raw($settings['nbu_url']),
            'feedUrl' => esc_url_raw($settings['feed_url']),
            'fxCacheKey' => sanitize_key($settings['fx_cache_key']),
            'currencies' => $this->parse_currency_map($settings['currencies']),
            'extraCurrencyOptions' => $this->parse_currency_options($settings['extra_currency_options']),
            'selectors' => [
                'card' => $settings['card_selector'],
                'feedCard' => $settings['feed_card_selector'],
                'title' => $settings['title_selector'],
                'button' => $settings['button_selector'],
                'price' => $settings['price_selector'],
                'measure' => $settings['measure_selector'],
                'currency' => $settings['currency_selector'],
                'unitToggle' => $settings['unit_toggle_selector'],
            ],
            'sale' => [
                'classPrefix' => sanitize_key($settings['sale_class_prefix']),
                'wrapperClass' => sanitize_html_class($settings['sale_wrapper_class']),
                'readyData' => sanitize_key($settings['sale_ready_data']),
                'oldButtonText' => sanitize_text_field($settings['old_button_text']),
                'newButtonText' => sanitize_text_field($settings['new_button_text']),
                'newButtonClass' => sanitize_html_class($settings['sale_new_button_class']),
                'badgeBg' => sanitize_hex_color($settings['sale_badge_bg']) ?: '#c00',
                'badgeColor' => sanitize_hex_color($settings['sale_badge_color']) ?: '#fff',
            ],
            'feed' => [
                'pathMarker' => sanitize_title($settings['feed_url_path_marker']),
                'stripSuffixRegex' => $settings['feed_strip_suffix_regex'],
            ],
        ];
    }

    private function parse_currency_map($raw) {
        $map = [];
        $lines = preg_split('/\r\n|\r|\n/', (string) $raw);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            $parts = array_map('trim', explode('|', $line));
            if (count($parts) < 2) {
                continue;
            }
            $code = strtoupper(sanitize_text_field($parts[0]));
            if (!preg_match('/^[A-Z]{3}$/', $code)) {
                continue;
            }
            $map[$code] = [
                'symbol' => sanitize_text_field($parts[1]),
                'position' => isset($parts[2]) && in_array($parts[2], ['before', 'after'], true) ? $parts[2] : 'after',
                'label' => isset($parts[3]) ? sanitize_text_field($parts[3]) : $code,
            ];
        }
        return $map;
    }

    private function parse_currency_options($raw) {
        $options = [];
        $lines = preg_split('/\r\n|\r|\n/', (string) $raw);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            $parts = array_map('trim', explode('|', $line, 2));
            if (count($parts) < 2) {
                continue;
            }
            $code = strtoupper(sanitize_text_field($parts[0]));
            if (!preg_match('/^[A-Z]{3}$/', $code)) {
                continue;
            }
            $options[] = ['value' => $code, 'label' => sanitize_text_field($parts[1])];
        }
        return $options;
    }

    public function add_admin_page() {
        add_options_page(
            'YO Product Cards',
            'YO Product Cards',
            'manage_options',
            'yo-product-card-enhancer',
            [$this, 'render_admin_page']
        );
    }

    public function register_settings() {
        register_setting('yo_pce_settings_group', self::OPTION_NAME, [$this, 'sanitize_settings']);
    }

    public function sanitize_settings($input) {
        $defaults = self::defaults();
        $input = is_array($input) ? $input : [];
        $output = self::get_settings();
        $tab = isset($input['_tab']) ? sanitize_key($input['_tab']) : 'general';
        $checkbox_tabs = [
            'enabled' => 'general', 'enable_units' => 'general', 'enable_currency' => 'general',
            'enable_sale' => 'general', 'enable_feed_ids' => 'general',
            'enable_personalization' => 'personalization', 'enable_size_adaptation' => 'personalization',
            'enable_matching_headpiece' => 'personalization', 'enable_extra_rhinestones' => 'personalization',
        ];

        foreach ($defaults as $key => $default) {
            if (strpos($key, 'enable') === 0 || $key === 'enabled') {
                if (isset($input[$key]) || (isset($checkbox_tabs[$key]) && $checkbox_tabs[$key] === $tab)) {
                    $output[$key] = !empty($input[$key]) ? '1' : '0';
                }
                continue;
            }

            if (!array_key_exists($key, $input)) continue;

            $value = isset($input[$key]) ? wp_unslash($input[$key]) : $default;

            switch ($key) {
                case 'size_adaptation_price':
                case 'matching_headpiece_price':
                case 'extra_rhinestones_price':
                    $output[$key] = is_scalar($value) && is_numeric($value) && is_finite((float) $value) && (float) $value >= 0
                        ? (string) round((float) $value, 2) : $output[$key];
                    break;
                case 'cm_per_inch':
                    $output[$key] = is_numeric($value) && (float) $value > 0 ? (string) (float) $value : $default;
                    break;
                case 'default_unit':
                    $output[$key] = in_array($value, ['cm', 'in'], true) ? $value : 'cm';
                    break;
                case 'default_currency':
                    $value = strtoupper(sanitize_text_field($value));
                    $output[$key] = preg_match('/^[A-Z]{3}$/', $value) ? $value : 'EUR';
                    break;
                case 'nbu_url':
                case 'feed_url':
                    $output[$key] = esc_url_raw($value);
                    break;
                case 'sale_badge_bg':
                case 'sale_badge_color':
                    $output[$key] = sanitize_hex_color($value) ?: $default;
                    break;
                case 'currencies':
                case 'extra_currency_options':
                    $output[$key] = sanitize_textarea_field($value);
                    break;
                default:
                    $output[$key] = sanitize_text_field($value);
            }
        }

        return $output;
    }

    public function add_settings_link($links) {
        $url = admin_url('options-general.php?page=yo-product-card-enhancer');
        array_unshift($links, '<a href="' . esc_url($url) . '">Settings</a>');
        return $links;
    }

    private function checkbox($settings, $key, $label) {
        echo '<label><input type="checkbox" name="' . esc_attr(self::OPTION_NAME) . '[' . esc_attr($key) . ']" value="1" ' . checked(!empty($settings[$key]), true, false) . '> ' . esc_html($label) . '</label>';
    }

    private function input($settings, $key, $label, $type = 'text', $description = '') {
        echo '<tr><th scope="row"><label for="yo_pce_' . esc_attr($key) . '">' . esc_html($label) . '</label></th><td>';
        echo '<input class="regular-text" type="' . esc_attr($type) . '" ' . ($type === 'number' ? 'min="0" step="0.01" ' : '') . 'id="yo_pce_' . esc_attr($key) . '" name="' . esc_attr(self::OPTION_NAME) . '[' . esc_attr($key) . ']" value="' . esc_attr($settings[$key]) . '">';
        if ($description) {
            echo '<p class="description">' . esc_html($description) . '</p>';
        }
        echo '</td></tr>';
    }

    private function textarea($settings, $key, $label, $description = '', $rows = 6) {
        echo '<tr><th scope="row"><label for="yo_pce_' . esc_attr($key) . '">' . esc_html($label) . '</label></th><td>';
        echo '<textarea class="large-text code" rows="' . (int) $rows . '" id="yo_pce_' . esc_attr($key) . '" name="' . esc_attr(self::OPTION_NAME) . '[' . esc_attr($key) . ']">' . esc_textarea($settings[$key]) . '</textarea>';
        if ($description) {
            echo '<p class="description">' . esc_html($description) . '</p>';
        }
        echo '</td></tr>';
    }

    public function render_admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        $settings = self::get_settings();
        $tab = isset($_GET['tab']) ? sanitize_key($_GET['tab']) : 'general';
        $tabs = [
            'general' => 'General',
            'currency' => 'Currency',
            'selectors' => 'Selectors',
            'sale' => 'Sale buttons',
            'feed' => 'Feed IDs',
            'personalization' => 'Дополнительные опции',
        ];
        if (!isset($tabs[$tab])) {
            $tab = 'general';
        }
        echo '<div class="wrap"><h1>YOleotard Product Card Enhancer</h1>';
        echo '<p>This plugin replaces the previous footer snippet and keeps the same frontend functions in one manageable plugin.</p>';
        echo '<nav class="nav-tab-wrapper">';
        foreach ($tabs as $key => $label) {
            $url = admin_url('options-general.php?page=yo-product-card-enhancer&tab=' . $key);
            echo '<a class="nav-tab ' . ($tab === $key ? 'nav-tab-active' : '') . '" href="' . esc_url($url) . '">' . esc_html($label) . '</a>';
        }
        echo '</nav>';
        echo '<form method="post" action="options.php">';
        settings_fields('yo_pce_settings_group');
        echo '<input type="hidden" name="' . esc_attr(self::OPTION_NAME) . '[_tab]" value="' . esc_attr($tab) . '">';
        echo '<table class="form-table" role="presentation"><tbody>';

        if ($tab === 'general') {
            echo '<tr><th scope="row">Plugin status</th><td>';
            $this->checkbox($settings, 'enabled', 'Enable plugin');
            echo '<br>'; $this->checkbox($settings, 'enable_units', 'Enable cm / inch switcher');
            echo '<br>'; $this->checkbox($settings, 'enable_currency', 'Enable currency converter');
            echo '<br>'; $this->checkbox($settings, 'enable_sale', 'Enable sale buttons by saleXX class');
            echo '<br>'; $this->checkbox($settings, 'enable_feed_ids', 'Enable Google feed ID matching');
            echo '</td></tr>';
            $this->input($settings, 'cm_per_inch', 'Centimeters per inch', 'number');
            $this->input($settings, 'default_unit', 'Default unit', 'text', 'Use cm or in.');
            $this->input($settings, 'default_currency', 'Default currency', 'text', 'Example: EUR, USD, GBP.');
        }

        if ($tab === 'personalization') {
            echo '<tr><th scope="row">Дополнительные опции</th><td>';
            $this->checkbox($settings, 'enable_personalization', 'Включить дополнительные опции');
            echo '<br>'; $this->checkbox($settings, 'enable_size_adaptation', 'Подгонка по меркам');
            echo '<br>'; $this->checkbox($settings, 'enable_matching_headpiece', 'Украшение для волос');
            echo '<br>'; $this->checkbox($settings, 'enable_extra_rhinestones', 'Дополнительный набор страз');
            echo '</td></tr>';
            $this->input($settings, 'size_adaptation_price', 'Подгонка по меркам (EUR)', 'number');
            $this->input($settings, 'matching_headpiece_price', 'Украшение для волос (EUR)', 'number');
            $this->input($settings, 'extra_rhinestones_price', 'Дополнительный набор страз (EUR)', 'number');
        }

        if ($tab === 'currency') {
            $this->input($settings, 'nbu_url', 'NBU exchange rate URL', 'url');
            $this->input($settings, 'fx_cache_key', 'Browser FX cache key', 'text');
            $this->textarea($settings, 'currencies', 'Currency formatting', 'One currency per line: CODE|symbol|before/after|label', 8);
            $this->textarea($settings, 'extra_currency_options', 'Options added to existing currency select', 'One option per line: CODE|Label. This preserves the old PLN and AUD auto-add behavior.', 5);
        }

        if ($tab === 'selectors') {
            $this->input($settings, 'card_selector', 'Card root selector', 'text');
            $this->input($settings, 'feed_card_selector', 'Feed ID card selector', 'text');
            $this->input($settings, 'title_selector', 'Product title selector', 'text');
            $this->input($settings, 'button_selector', 'Buy button selector', 'text');
            $this->input($settings, 'price_selector', 'Price selector', 'text');
            $this->input($settings, 'measure_selector', 'Measure selector', 'text');
            $this->input($settings, 'currency_selector', 'Currency selector', 'text');
            $this->input($settings, 'unit_toggle_selector', 'Unit toggle selector', 'text');
        }

        if ($tab === 'sale') {
            $this->input($settings, 'sale_class_prefix', 'Sale class prefix', 'text', 'Default sale means classes like sale10, sale30, sale50.');
            $this->input($settings, 'sale_wrapper_class', 'Wrapper CSS class', 'text');
            $this->input($settings, 'sale_ready_data', 'Processed card data key', 'text');
            $this->input($settings, 'old_button_text', 'Old button text', 'text');
            $this->input($settings, 'new_button_text', 'New button text', 'text');
            $this->input($settings, 'sale_new_button_class', 'New button UIkit class', 'text');
            $this->input($settings, 'sale_badge_bg', 'Sale badge background', 'text');
            $this->input($settings, 'sale_badge_color', 'Sale badge text color', 'text');
        }

        if ($tab === 'feed') {
            $this->input($settings, 'feed_url', 'Google Shopping feed URL', 'url');
            $this->input($settings, 'feed_url_path_marker', 'Product path marker', 'text', 'Default: yoleotard-product');
            $this->input($settings, 'feed_strip_suffix_regex', 'Slug suffix cleanup regex', 'text', 'Advanced setting. Keeps old cleanup logic for _for_height and numeric suffixes.');
        }

        echo '</tbody></table>';
        submit_button($tab === 'personalization' ? 'Сохранить настройки' : 'Save settings');
        echo '</form></div>';
    }
}

new YO_Product_Card_Enhancer();
