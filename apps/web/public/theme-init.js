// Applies the stored theme before first paint so there is no flash (§8.9.3).
// An external file because the CSP forbids inline scripts. Keep in sync with
// src/infrastructure/platform/theme.ts.
(function () {
  try {
    var theme = localStorage.getItem('powr.theme');
    if (theme !== 'light' && theme !== 'dark') return;
    document.documentElement.dataset.theme = theme;
    var color = theme === 'dark' ? '#101214' : '#f6f6f4';
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', color);
  } catch {
    // Storage unavailable: fall back to the system theme.
  }
})();
