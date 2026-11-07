const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\adity\\.gemini\\antigravity\\brain\\d3bea511-77d9-4046-8491-4776812cb7dc';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyPlayer() {
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9225',
    '--window-size=1920,1080',
    'about:blank',
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch('http://127.0.0.1:9225/json/version');
        const data = await res.json();
        if (data.webSocketDebuggerUrl) {
          wsUrl = data.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
    }

    if (!wsUrl) throw new Error('Failed to connect to Chrome debugging port');

    const targetRes = await fetch('http://127.0.0.1:9225/json/new?about:blank', {
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

    // Click on the first song to start playback
    console.log('Clicking on first album card to play...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const cards = document.querySelectorAll('.group.relative.aspect-square');
          if (cards.length > 0) {
            cards[0].click();
            return 'clicked card';
          }
          return 'no card';
        })()
      `,
    });
    await sleep(2500);

    // Open expanded player by clicking mini player or setting query
    console.log('Opening expanded player...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const miniPlayer = document.querySelector('[role="region"]') || document.querySelector('.fixed.bottom-0');
          if (miniPlayer) {
            miniPlayer.click();
            return 'clicked mini player';
          }
          return 'no mini player';
        })()
      `,
    });
    await sleep(2000);

    const playerShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'desktop_player_verified.png'), Buffer.from(playerShot.data, 'base64'));
    console.log('Saved desktop_player_verified.png');

    ws.close();
  } catch (e) {
    console.error('Error:', e);
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

verifyPlayer();

