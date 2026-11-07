const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\adity\\.gemini\\antigravity\\brain\\d3bea511-77d9-4046-8491-4776812cb7dc';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('Launching headless Chrome for full import flow capture...');
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

    // 1. Navigate to Library
    console.log('Clicking Library navigation...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const libBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Library');
        if (libBtn) libBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      `,
    });
    await sleep(2000);

    // 2. Click "Import Playlist"
    console.log('Clicking "Import Playlist"...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const importBtn = btns.find(b => b.textContent && b.textContent.includes('Import Playlist'));
        if (importBtn) importBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      `,
    });
    await sleep(1500);

    // Screenshot 1: Input Modal
    console.log('Capturing Screenshot 1: Input State...');
    const ss1 = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'playlist_import_modal_input.png'), Buffer.from(ss1.data, 'base64'));

    // 3. Click "Today's Top Hits" sample
    console.log('Clicking sample playlist button...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const sampleBtn = btns.find(b => b.textContent && b.textContent.includes("Today's Top Hits"));
        if (sampleBtn) sampleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      `,
    });

    // Wait for Spotify fetch + fuzzy matching engine
    console.log('Waiting 7s for Spotify extraction and catalogue matching...');
    await sleep(7000);

    // Screenshot 2: Preview Screen
    console.log('Capturing Screenshot 2: Preview Screen...');
    const ss2 = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'playlist_import_modal_preview.png'), Buffer.from(ss2.data, 'base64'));

    // 4. Click "Import 1 Matched Tracks"
    console.log('Clicking Import Matched Tracks...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const confirmBtn = btns.find(b => b.textContent && b.textContent.includes('Import') && b.textContent.includes('Matched'));
        if (confirmBtn) confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      `,
    });
    await sleep(3500);

    // Screenshot 3: Success Confirmation Screen
    console.log('Capturing Screenshot 3: Success Confirmation...');
    const ss3 = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'playlist_import_modal_success.png'), Buffer.from(ss3.data, 'base64'));

    // 5. Click "View Playlist"
    console.log('Clicking "View Playlist"...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const viewBtn = btns.find(b => b.textContent && b.textContent.includes('View Playlist'));
        if (viewBtn) viewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      `,
    });
    await sleep(3000);

    // Screenshot 4: Playlist Detail View
    console.log('Capturing Screenshot 4: Playlist Detail View...');
    const ss4 = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'imported_playlist_detail_verified.png'), Buffer.from(ss4.data, 'base64'));

    ws.close();
    console.log('🎉 All 4 screenshots captured successfully!');
  } finally {
    try { chromeProc.kill(); } catch (e) {}
  }
}

run().catch(console.error);
