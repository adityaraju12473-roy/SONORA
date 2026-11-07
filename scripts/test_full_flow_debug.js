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
    await sendCommand('Log.enable');

    ws.addEventListener('message', (evt) => {
      const p = JSON.parse(evt.data);
      if (p.method === 'Runtime.consoleAPICalled') {
        console.log('[BROWSER CONSOLE]', p.params.type, p.params.args.map(a => a.value || a.description));
      }
    });

    console.log('Navigating to http://localhost:5173...');
    await sendCommand('Page.navigate', { url: 'http://localhost:5173' });
    await sleep(2500);

    // Open Library
    await sendCommand('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const libBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Library');
        if (libBtn) libBtn.click();
      `,
    });
    await sleep(1500);

    // Click Import Playlist
    await sendCommand('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const importBtn = btns.find(b => b.textContent && b.textContent.includes('Import Playlist'));
        if (importBtn) importBtn.click();
      `,
    });
    await sleep(1000);

    // Click sample button
    console.log('Clicking Sample button...');
    const clickRes = await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const sampleBtn = btns.find(b => b.textContent && b.textContent.includes("Today's Top Hits"));
          if (sampleBtn) {
            sampleBtn.click();
            return { found: true };
          }
          return { found: false, allButtons: btns.map(b => b.innerText) };
        })()
      `,
      returnByValue: true,
    });
    console.log('Sample button click result:', clickRes.result.value);

    // Poll until preview appears or 10s
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const state = await sendCommand('Runtime.evaluate', {
        expression: `
          (() => {
            const text = document.body.innerText;
            const hasMatchedSongs = text.includes('Matched in SONORA');
            const hasError = text.includes('Failed to extract') || text.includes('error');
            const hasLoading = text.includes('Analyzing playlist') || text.includes('Connecting');
            return { hasMatchedSongs, hasError, hasLoading };
          })()
        `,
        returnByValue: true,
      });
      console.log(`Polling status [${i}s]:`, state.result.value);
      if (state.result.value.hasMatchedSongs) {
        console.log('Preview found!');
        break;
      }
    }

    // Capture Preview Screenshot
    console.log('Capturing Preview Screenshot...');
    const ssPreview = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'playlist_import_modal_preview.png'), Buffer.from(ssPreview.data, 'base64'));
    console.log('Saved playlist_import_modal_preview.png');

    // Click "Import Matched Tracks"
    console.log('Clicking Import Matched Tracks button...');
    const importClick = await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => b.textContent && b.textContent.includes('Import') && b.textContent.includes('Matched'));
          if (btn) {
            btn.click();
            return { found: true, text: btn.innerText };
          }
          return { found: false };
        })()
      `,
      returnByValue: true,
    });
    console.log('Import click:', importClick.result.value);

    await sleep(3500);

    // Capture Success Screenshot
    console.log('Capturing Success Screenshot...');
    const ssSuccess = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'playlist_import_modal_success.png'), Buffer.from(ssSuccess.data, 'base64'));
    console.log('Saved playlist_import_modal_success.png');

    // Click "View Playlist"
    console.log('Clicking "View Playlist"...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const viewBtn = btns.find(b => b.textContent && b.textContent.includes('View Playlist'));
        if (viewBtn) viewBtn.click();
      `,
    });
    await sleep(2500);

    // Capture Playlist Detail Screenshot
    console.log('Capturing Detail Screenshot...');
    const ssDetail = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'imported_playlist_detail_verified.png'), Buffer.from(ssDetail.data, 'base64'));
    console.log('Saved imported_playlist_detail_verified.png');

    ws.close();
  } finally {
    try { chromeProc.kill(); } catch (e) {}
  }
}

run().catch(console.error);

