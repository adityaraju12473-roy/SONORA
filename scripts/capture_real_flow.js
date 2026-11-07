const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\adity\\.gemini\\antigravity\\brain\\d3bea511-77d9-4046-8491-4776812cb7dc';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('Launching headless Chrome for reliable full flow capture...');
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
    console.log('Clicking Library tab...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const libBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Library');
          if (libBtn) {
            libBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          }
        })()
      `,
    });
    await sleep(2000);

    // 2. Click "Import Playlist"
    console.log('Clicking "Import Playlist"...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const importBtn = btns.find(b => b.textContent && b.textContent.includes('Import Playlist'));
          if (importBtn) {
            importBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          }
        })()
      `,
    });
    await sleep(1500);

    // Capture Screenshot 1: Input State
    console.log('Capturing Screenshot 1: Input State...');
    const ss1 = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'playlist_import_modal_input.png'), Buffer.from(ss1.data, 'base64'));
    console.log('Saved playlist_import_modal_input.png');

    // 3. Click "Today's Top Hits" sample button
    console.log('Clicking "Today\'s Top Hits" sample button...');
    const clickSample = await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const sampleBtn = btns.find(b => b.textContent && b.textContent.includes("Today's Top Hits"));
          if (sampleBtn) {
            sampleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            return { found: true };
          }
          return { found: false, count: btns.length };
        })()
      `,
      returnByValue: true,
    });
    console.log('Click sample result:', clickSample.result.value);

    // Wait for Spotify fetch + matching engine to finish
    console.log('Waiting for playlist metadata and song matching...');
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const state = await sendCommand('Runtime.evaluate', {
        expression: `
          (() => {
            const text = document.body.innerText;
            const hasMatchedSongs = text.includes('Matched in SONORA');
            return hasMatchedSongs;
          })()
        `,
        returnByValue: true,
      });
      console.log(`Polling match state [${i+1}s]:`, state.result.value);
      if (state.result.value) {
        console.log('Preview state loaded!');
        break;
      }
    }

    // Capture Screenshot 2: Preview State
    console.log('Capturing Screenshot 2: Preview State...');
    const ss2 = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'playlist_import_modal_preview.png'), Buffer.from(ss2.data, 'base64'));
    console.log('Saved playlist_import_modal_preview.png');

    // 4. Click "Import X Matched Tracks"
    console.log('Clicking Import Matched Tracks button...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const confirmBtn = btns.find(b => b.textContent && b.textContent.includes('Import') && b.textContent.includes('Matched'));
          if (confirmBtn) {
            confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          }
        })()
      `,
    });
    await sleep(3500);

    // Capture Screenshot 3: Success Confirmation Screen
    console.log('Capturing Screenshot 3: Success Confirmation...');
    const ss3 = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'playlist_import_modal_success.png'), Buffer.from(ss3.data, 'base64'));
    console.log('Saved playlist_import_modal_success.png');

    // 5. Click "View Playlist"
    console.log('Clicking "View Playlist"...');
    await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const viewBtn = btns.find(b => b.textContent && b.textContent.includes('View Playlist'));
          if (viewBtn) {
            viewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          }
        })()
      `,
    });
    await sleep(3000);

    // Capture Screenshot 4: Playlist Detail View
    console.log('Capturing Screenshot 4: Playlist Detail View...');
    const ss4 = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'imported_playlist_detail_verified.png'), Buffer.from(ss4.data, 'base64'));
    console.log('Saved imported_playlist_detail_verified.png');

    ws.close();
    console.log('🎉 All 4 screenshots captured successfully!');
  } finally {
    try { chromeProc.kill(); } catch (e) {}
  }
}

run().catch(console.error);
