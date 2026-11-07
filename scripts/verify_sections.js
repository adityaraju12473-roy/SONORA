const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\adity\\.gemini\\antigravity\\brain\\d3bea511-77d9-4046-8491-4776812cb7dc';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifySections() {
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9224',
    '--window-size=1920,1080',
    'about:blank',
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch('http://127.0.0.1:9224/json/version');
        const data = await res.json();
        if (data.webSocketDebuggerUrl) {
          wsUrl = data.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
    }

    if (!wsUrl) throw new Error('Failed to connect to Chrome debugging port');

    const targetRes = await fetch('http://127.0.0.1:9224/json/new?about:blank', {
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

    await sendCommand('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(3500);

    // Navigate to Library
    await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Library'));
          if (btn) btn.click();
        })()
      `,
    });
    await sleep(2500);

    // Click "Artists (21)" tab
    console.log('Clicking Artists tab...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Artists'));
          if (btn) btn.click();
        })()
      `,
    });
    await sleep(2000);

    const artistsShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'library_artists_verified.png'), Buffer.from(artistsShot.data, 'base64'));
    console.log('Saved library_artists_verified.png');

    // Click "Songs (910)" tab
    console.log('Clicking Songs tab...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Songs'));
          if (btn) btn.click();
        })()
      `,
    });
    await sleep(2000);

    const songsShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'library_songs_verified.png'), Buffer.from(songsShot.data, 'base64'));
    console.log('Saved library_songs_verified.png');

    ws.close();
  } catch (e) {
    console.error('Error:', e);
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

verifySections();

