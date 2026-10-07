module.exports = {
  testDir: './tests', testMatch: '**/*.spec.js', workers: 1,
  use: { browserName: 'chromium', headless: true },
  reporter: 'list'
};
