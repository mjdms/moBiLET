const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'dist', 'index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // 1. Inject manifest link and theme color
  if (!html.includes('rel="manifest"')) {
    const manifestLink = '\n    <link rel="manifest" href="./manifest.json" />\n    <meta name="theme-color" content="#1161a6" />';
    html = html.replace('</head>', `${manifestLink}\n  </head>`);
  }

  // 2. Inject iOS specific meta tags and disable zooming
  const iosTags = `
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="moBiLET">
    <link rel="apple-touch-icon" href="./mobilet.png">
  `;
  if (!html.includes('apple-mobile-web-app-capable')) {
     html = html.replace('</head>', `${iosTags}\n  </head>`);
  }

  // 2.1 Fix viewport to prevent zooming
  const viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />';
  if (html.includes('<meta name="viewport"')) {
    html = html.replace(/<meta name="viewport"[^>]*>/, viewportMeta);
  } else {
    html = html.replace('</head>', `${viewportMeta}\n  </head>`);
  }

  // 3. Inject service worker registration
  if (!html.includes('serviceWorker.register')) {
    const swScript = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./service-worker.js');
        });
      }
    </script>`;
    html = html.replace('</body>', `${swScript}\n  </body>`);
  }

  fs.writeFileSync(indexPath, html);
  console.log('PWA metadata successfully injected into dist/index.html');
} else {
  console.error('Error: dist/index.html not found.');
}
