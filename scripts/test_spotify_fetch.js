const fs = require('fs');

async function test() {
  const url = 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const html = await res.text();
    const regex = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;
    const match = html.match(regex);
    if (match) {
      const json = JSON.parse(match[1]);
      const entity = json.props?.pageProps?.state?.data?.entity;
      if (entity) {
        console.log('Playlist Name:', entity.name);
        console.log('Cover:', entity.coverArt?.sources?.[0]?.url);
        console.log('Track count:', entity.trackList?.length);
        console.log('Sample track 1:', entity.trackList?.[0]?.title, 'by', entity.trackList?.[0]?.subtitle);
        return;
      }
    }
    console.log('__NEXT_DATA__ not found or format changed. HTML length:', html.length);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();

