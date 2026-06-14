const assert = require('assert');
const fs = require('fs');
const path = require('path');

const frontendPath = path.join(
  __dirname,
  '..',
  'yoleotard-product-card-enhancer',
  'assets',
  'js',
  'frontend.js'
);

const source = fs.readFileSync(frontendPath, 'utf8');
const bullet = String.fromCharCode(8226);

assert(
  !source.includes(` ${bullet} <span class="yo-price"`),
  'Sale button labels must not render a bullet separator before the price.'
);

assert(
  source.includes('<span class="sale-badge" data-eur="'),
  'Sale discount badge markup should remain in the generated button.'
);
