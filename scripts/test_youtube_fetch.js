async function test() {
  const playlistId = 'PLrEnWoR732-BHrPp_QLgkMNVNw1fQAguC';
  const url = `https://www.youtube.com/playlist?list=${playlistId}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const html = await res.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/s);
    if (match) {
      const data = JSON.parse(match[1]);
      console.log('Top keys:', Object.keys(data));
      if (data.metadata?.playlistMetadataRenderer) {
        console.log('Metadata title:', data.metadata.playlistMetadataRenderer.title);
      }
      // Recursively find videoRenderers
      const jsonStr = match[1];
      const videoTitles = [...jsonStr.matchAll(/"title":\{"runs":\[\{"text":"(.*?)"\}\]/g)].map(m => m[1]);
      console.log('Found video titles count:', videoTitles.length);
      console.log('First 5 titles:', videoTitles.slice(0, 5));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
