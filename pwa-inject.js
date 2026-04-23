const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'dist', 'index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // Inject manifest link if missing
  if (!html.includes('rel="manifest"')) {
    const manifestLink = '\n    <link rel="manifest" href="./manifest.json" />';
    html = html.replace('</head>', `${manifestLink}\n  </head>`);
  }

  // Inject service worker script if missing
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
