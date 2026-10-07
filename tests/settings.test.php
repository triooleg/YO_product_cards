<?php
define('ABSPATH', __DIR__);
function add_action() {}
function add_filter() {}
function plugin_basename($file) { return basename($file); }
function get_option($name, $default) { return $GLOBALS['saved_settings'] ?? $default; }
function wp_parse_args($saved, $defaults) { return array_merge($defaults, $saved); }
function wp_unslash($value) { return $value; }
function sanitize_key($value) { return preg_replace('/[^a-z0-9_\-]/', '', strtolower($value)); }
function sanitize_text_field($value) { return strip_tags($value); }
function sanitize_textarea_field($value) { return strip_tags($value); }
function esc_url_raw($value) { return $value; }
function sanitize_hex_color($value) { return preg_match('/^#[0-9a-f]{3,6}$/i', $value) ? $value : null; }
function current_user_can($capability) { return true; }
function admin_url($path) { return '/wp-admin/' . $path; }
function esc_attr($value) { return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8'); }
function esc_html($value) { return esc_attr($value); }
function esc_url($value) { return esc_attr($value); }
function checked($actual, $expected, $echo = true) { return $actual === $expected ? 'checked="checked"' : ''; }
function settings_fields($group) {}
function submit_button($label) { echo '<button type="submit">' . esc_html($label) . '</button>'; }
require __DIR__ . '/../yoleotard-product-card-enhancer/yoleotard-product-card-enhancer.php';
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
$plugin = new YO_Product_Card_Enhancer();
$GLOBALS['saved_settings'] = ['default_currency' => 'USD', 'nbu_url' => 'https://custom.example/rates', 'enable_units' => '1', 'matching_headpiece_price' => '19.75'];
$out = $plugin->sanitize_settings(['_tab' => 'personalization', 'enable_personalization' => '1', 'enable_matching_headpiece' => '1', 'matching_headpiece_price' => '21.555', 'size_adaptation_price' => '-5', 'extra_rhinestones_price' => 'abc']);
check($out['default_currency'] === 'USD' && $out['nbu_url'] === 'https://custom.example/rates', 'Existing settings must survive saving a different tab.');
check($out['enable_units'] === '1', 'Other-tab checkboxes must survive.');
check($out['enable_size_adaptation'] === '0', 'Unchecked checkbox on current tab must turn off.');
check($out['matching_headpiece_price'] === '21.56', 'Addon prices must round to cents.');
check($out['size_adaptation_price'] === '25' && $out['extra_rhinestones_price'] === '10', 'Invalid prices must preserve valid values.');
$GLOBALS['saved_settings'] = $out;
$again = $plugin->sanitize_settings($out);
check($again['enable_personalization'] === '1', 'Repeated sanitizer call must preserve posted checkboxes.');
$general = $plugin->sanitize_settings(['_tab' => 'general', 'enabled' => '1']);
check($general['matching_headpiece_price'] === '21.56' && $general['enable_personalization'] === '1', 'General tab must preserve personalization.');
$prices = $plugin->sanitize_settings(['_tab' => 'personalization', 'size_adaptation_price' => '0', 'matching_headpiece_price' => '12.5', 'extra_rhinestones_price' => '7.99']);
check($prices['size_adaptation_price'] === '0' && $prices['matching_headpiece_price'] === '12.5' && $prices['extra_rhinestones_price'] === '7.99', 'All three prices, including zero, must be editable.');
$GLOBALS['saved_settings'] = $prices;
$_GET['tab'] = 'personalization';
ob_start();
$plugin->render_admin_page();
$html = ob_get_clean();
check(strpos($html, 'Дополнительные опции') !== false, 'Addon tab must be visible.');
foreach (['size_adaptation_price', 'matching_headpiece_price', 'extra_rhinestones_price'] as $key) {
    check(strpos($html, 'id="yo_pce_' . $key . '"') !== false, 'Price field must be rendered: ' . $key);
    check(strpos($html, 'name="yo_pce_settings[' . $key . ']" value="' . $prices[$key] . '"') !== false, 'Saved price must be rendered: ' . $key);
}
check(substr_count($html, 'min="0" step="0.01"') === 3, 'All addon fields must allow nonnegative cent prices.');
echo "Settings tests passed.\n";
