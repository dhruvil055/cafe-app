async function getImg(pageUrl) {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const m = html.match(/https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9\-]+/g);
    if (m) {
      console.log('Found:', [...new Set(m)].slice(0, 3));
    } else {
      console.log('Not found, status:', res.status);
    }
  } catch(e) {
    console.log('Error:', e.message);
  }
}

getImg('https://unsplash.com/photos/garlic-bread-with-herbs-and-cheese-on-a-plate-hLSwCdJLMWE');
