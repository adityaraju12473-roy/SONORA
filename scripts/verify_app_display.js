const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\adity\\.gemini\\antigravity\\brain\\d3bea511-77d9-4046-8491-4776812cb7dc';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verify() {
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9223',
    '--window-size=1920,1080',
    'about:blank',
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch('http://127.0.0.1:9223/json/version');
        const data = await res.json();
        if (data.webSocketDebuggerUrl) {
          wsUrl = data.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
    }

    if (!wsUrl) throw new Error('Failed to connect to Chrome debugging port');

    const targetRes = await fetch('http://127.0.0.1:9223/json/new?about:blank', {
      method: 'PUT',
    });
    const targetData = await targetRes.json();
    const ws = new WebSocket(targetData.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    let msgId = 1;
    function sendCommand(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendCommand('Runtime.enable');
    await sendCommand('Page.enable');

    console.log('Navigating to http://localhost:5173/ (clean session, zero local auth)...');
    await sendCommand('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(4000);

    // Evaluate Discover Page Content
    const discoverStats = await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const bodyText = document.body.innerText;
          const imgCount = document.querySelectorAll('img').length;
          const albumImages = Array.from(document.querySelectorAll('img')).map(img => img.src).filter(s => s.includes('apple') || s.includes('mzstatic') || s.includes('cloudinary'));
          const songElements = document.querySelectorAll('.group');
          return {
            title: document.title,
            bodyLength: bodyText.length,
            imgCount,
            validArtworkCount: albumImages.length,
            hasAlbumsHeading: bodyText.includes('Albums'),
            hasSongsOnDisplay: bodyText.includes('Songs on Display'),
            firstFewAlbumUrls: albumImages.slice(0, 3)
          };
        })()
      `,
      returnByValue: true,
    });

    console.log('Discover Page Stats:', JSON.stringify(discoverStats.result.value, null, 2));

    const discoverShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'discover_verified.png'), Buffer.from(discoverShot.data, 'base64'));
    console.log('Saved discover_verified.png');

    // Click on Library in bottom nav
    console.log('Clicking on Library nav button...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const libBtn = buttons.find(b => b.innerText.includes('Library'));
          if (libBtn) {
            libBtn.click();
            return 'clicked';
          }
          return 'not found';
        })()
      `,
    });
    await sleep(3000);

    // Evaluate Library Stats
    const libraryStats = await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const bodyText = document.body.innerText;
          const imgCount = document.querySelectorAll('img').length;
          // Look for badge counts
          const badges = Array.from(document.querySelectorAll('span, button')).map(e => e.innerText).filter(t => /\\b\\d+\\b/.test(t));
          return {
            bodyLength: bodyText.length,
            imgCount,
            sampleBadges: badges.slice(0, 10),
            hasTracks: bodyText.includes('Tracks') || bodyText.includes('tracks'),
            hasAlbums: bodyText.includes('Albums'),
            hasArtists: bodyText.includes('Artists')
          };
        })()
      `,
      returnByValue: true,
    });

    console.log('Library Page Stats:', JSON.stringify(libraryStats.result.value, null, 2));

    const libraryShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'library_verified.png'), Buffer.from(libraryShot.data, 'base64'));
    console.log('Saved library_verified.png');

    ws.close();
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

verify();

