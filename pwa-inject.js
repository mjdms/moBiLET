const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'dist', 'index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // 1. Inject manifest link
  if (!html.includes('rel="manifest"')) {
    html = html.replace('</head>', '\n    <link rel="manifest" href="./manifest.json" />\n  </head>');
  }

  // 2. Force theme-color and iOS meta tags
  const pwaTags = `
    <meta name="theme-color" content="#1161a6" />
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="moBiLET">
    <link rel="apple-touch-icon" href="./mobilet.png">
  `;
  
  // Clean up existing theme-color or apple meta tags if they exist to avoid conflicts
  html = html.replace(/<meta name="theme-color"[^>]*>/g, '');
  html = html.replace(/<meta name="apple-mobile-web-app-capable"[^>]*>/g, '');
  html = html.replace(/<meta name="apple-mobile-web-app-status-bar-style"[^>]*>/g, '');
  
  html = html.replace('</head>', `${pwaTags}\n  </head>`);

  // 3. Fix viewport to prevent zooming and enable edge-to-edge
  const viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />';
  if (html.includes('<meta name="viewport"')) {
    html = html.replace(/<meta name="viewport"[^>]*>/, viewportMeta);
  } else {
    html = html.replace('</head>', `${viewportMeta}\n  </head>`);
  }

  // 4. Inject service worker registration
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

  // 5. Ensure the root element background is consistent
  if (!html.includes('background-color: #1161a6')) {
    html = html.replace('</style>', 'body, #root { background-color: #1161a6; }\n    </style>');
  }

  fs.writeFileSync(indexPath, html);
  console.log('PWA metadata and colors successfully injected into dist/index.html');
} else {
  console.error('Error: dist/index.html not found.');
}
