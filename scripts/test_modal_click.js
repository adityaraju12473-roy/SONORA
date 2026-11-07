const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\adity\\.gemini\\antigravity\\brain\\d3bea511-77d9-4046-8491-4776812cb7dc';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    '--window-size=1600,1000',
    'about:blank',
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch('http://127.0.0.1:9222/json/version');
        const data = await res.json();
        if (data.webSocketDebuggerUrl) {
          wsUrl = data.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
    }

    const targetRes = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' });
    const targetData = await targetRes.json();
    const ws = new WebSocket(targetData.webSocketDebuggerUrl);

    await new Promise((resolve) => { ws.onopen = resolve; });

    let msgId = 1;
    function sendCommand(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (evt) => {
          const parsed = JSON.parse(evt.data);
          if (parsed.id === id) {
            ws.removeEventListener('message', handler);
            if (parsed.error) reject(parsed.error);
            else resolve(parsed.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendCommand('Page.enable');
    await sendCommand('Runtime.enable');

    console.log('Navigating to http://localhost:5173...');
    await sendCommand('Page.navigate', { url: 'http://localhost:5173' });
    await sleep(3000);

    // Click Library
    await sendCommand('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const libBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Library');
        if (libBtn) {
          libBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
      `,
    });
    await sleep(2000);

    // Click Import Playlist
    console.log('Clicking Import Playlist button with full MouseEvent...');
    const clickRes = await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const importBtn = btns.find(b => b.textContent && b.textContent.includes('Import Playlist'));
          if (importBtn) {
            importBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            return { found: true, text: importBtn.textContent };
          }
          return { found: false };
        })()
      `,
      returnByValue: true,
    });
    console.log('Click result:', clickRes.result.value);
    await sleep(1500);

    // Check if modal rendered
    const checkModal = await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const modalHeader = document.querySelector('h3');
          const allText = document.body.innerText;
          return {
            hasModalTitle: allText.includes('Import Playlist by Link'),
            headerText: modalHeader ? modalHeader.innerText : null
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Modal check:', checkModal.result.value);

    // Capture screenshot
    const ss = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'playlist_import_modal_input.png'), Buffer.from(ss.data, 'base64'));
    console.log('Saved playlist_import_modal_input.png');

    ws.close();
  } finally {
    try { chromeProc.kill(); } catch (e) {}
  }
}

run().catch(console.error);

