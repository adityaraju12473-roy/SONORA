const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\adity\\.gemini\\antigravity\\brain\\d3bea511-77d9-4046-8491-4776812cb7dc';
const serverDir = path.resolve(__dirname, '../server');
const { createClient } = require(path.join(serverDir, 'node_modules/@supabase/supabase-js'));
require(path.join(serverDir, 'node_modules/dotenv')).config({ path: path.join(serverDir, '.env') });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAuthToken() {
  const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'adityaraju12473@gmail.com',
  });
  const { data: sessionData } = await supabaseAnon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  });
  return sessionData.session.access_token;
}

async function capture() {
  const token = await getAuthToken();

  const backupData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'backup_songs_artwork_before_update.json'), 'utf8')
  );
  const sampleSong = backupData.songs[0];
  const sampleQueue = backupData.songs.slice(0, 20);

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    '--window-size=1920,1080',
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

    if (!wsUrl) throw new Error('Failed to connect to Chrome debugging port');

    const targetRes = await fetch('http://127.0.0.1:9222/json/new?about:blank', {
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

    await sendCommand('Page.navigate', { url: 'http://localhost:5174/' });
    await sleep(1500);

    await sendCommand('Runtime.evaluate', {
      expression: `
        localStorage.setItem('sonora_token', ${JSON.stringify(token)});
        localStorage.setItem('sonora_current_song', ${JSON.stringify(JSON.stringify(sampleSong))});
        localStorage.setItem('sonora_queue', ${JSON.stringify(JSON.stringify(sampleQueue))});
      `,
    });

    // 1. Desktop Viewport (1920x1080)
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sendCommand('Page.navigate', { url: 'http://localhost:5174/?player=expanded' });
    await sleep(3500);

    const desktopShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'desktop_expanded_player.png'), Buffer.from(desktopShot.data, 'base64'));
    console.log('1. Captured desktop_expanded_player.png');

    // 2. Desktop Queue View
    await sendCommand('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Queue'));
        if (btn) btn.click();
      `,
    });
    await sleep(1000);

    const desktopQueueShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'desktop_queue_view.png'), Buffer.from(desktopQueueShot.data, 'base64'));
    console.log('2. Captured desktop_queue_view.png');

    // 3. Mobile Viewport (390x844) - Fresh Navigation with showQueue=false
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sendCommand('Page.navigate', { url: 'http://localhost:5174/?player=expanded' });
    await sleep(3500);

    const mobileShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'mobile_expanded_player.png'), Buffer.from(mobileShot.data, 'base64'));
    console.log('3. Captured mobile_expanded_player.png (Artwork & Controls)');

    // 4. Mobile Queue View
    await sendCommand('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('button'));
        const queueBtn = btns.find(b => b.title === 'Show queue');
        if (queueBtn) queueBtn.click();
      `,
    });
    await sleep(1000);

    const mobileQueueShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'mobile_queue_view.png'), Buffer.from(mobileQueueShot.data, 'base64'));
    console.log('4. Captured mobile_queue_view.png (Queue view)');

    ws.close();
  } finally {
    chromeProc.kill();
    console.log('All screenshots captured successfully.');
  }
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
