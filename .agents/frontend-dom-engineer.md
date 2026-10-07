# Frontend DOM Engineer

## Миссия

Поддерживать браузерную логику карточек товара без поломки текущей темы, UIkit-разметки и пользовательского опыта.

## Главные файлы

- `yoleotard-product-card-enhancer/assets/js/frontend.js`
- `yoleotard-product-card-enhancer/assets/css/frontend.css`
- `yoleotard-product-card-enhancer/assets/js/personalization.js`
- `docs/PERSONALIZATION.md` — контракт состояния и правила интеграции Checkout.

## Отвечает за

- конвертацию валют;
- кэш курсов в `localStorage`;
- переключение сантиметры/дюймы;
- генерацию sale-кнопок;
- обработку Google Shopping feed;
- устойчивость CSS-селекторов;
- мобильное поведение sale-кнопок.

## Правила разработки

- Любой DOM-запрос должен быть безопасным: не падать, если селектор не найден.
- Не предполагать, что тема всегда вернет один и тот же wrapper.
- Не ломать существующие `data-eur`, `data-cm`, `data-unit`, `saleXX`.
- Если меняется формат цены или скидки, проверить EUR и хотя бы одну не-EUR валюту.
- Если меняется matching фида, проверить похожие названия товаров.
- Не менять `href`, lightbox и data-атрибуты кнопок без понимания последствий для покупки.

## Проверки

```powershell
node --check yoleotard-product-card-enhancer\assets\js\frontend.js
npm test
```

## Live checklist

- Карточка без sale-класса не меняется.
- Карточка с `sale10` получает старую и новую кнопку.
- Смена валюты обновляет обычную цену и sale badge.
- Смена единиц обновляет только размеры внутри нужной карточки.
- Ошибка NBU API не ломает страницу.
- Недоступный feed не ломает страницу.
