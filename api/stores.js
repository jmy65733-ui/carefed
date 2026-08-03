export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lat, lng, radius = 3000 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  const query = `[out:json][timeout:25];(node["shop"~"supermarket|grocery"](around:${radius},${lat},${lng});way["shop"~"supermarket|grocery"](around:${radius},${lat},${lng}););out center 15;`;

  // Try multiple Overpass endpoints
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
  ];

  let data = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Carefed App/1.0'
        },
        body: `data=${encodeURIComponent(query)}`
      });

      const text = await response.text();
      // Make sure it's JSON, not HTML
      if (!text.startsWith('<')) {
        data = JSON.parse(text);
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!data || !data.elements) {
    return res.status(200).json({ stores: [], message: 'Could not fetch stores' });
  }

  const ebtChains = ['h-e-b', 'heb', 'walmart', 'fiesta', 'aldi', 'kroger', 'randalls', 'whole foods', 'costco', 'target'];
  const wicChains = ['h-e-b', 'heb', 'walmart', 'kroger', 'randalls'];

  const latN = parseFloat(lat);
  const lngN = parseFloat(lng);

  const stores = data.elements
    .map(el => {
      const slat = el.lat || el.center?.lat;
      const slng = el.lon || el.center?.lon;
      const km = slat && slng
        ? Math.sqrt(
            Math.pow((slat - latN) * 111, 2) +
            Math.pow((slng - lngN) * 111 * Math.cos(latN * Math.PI / 180), 2)
          )
        : null;
      const dist = km
        ? km < 1 ? `${(km * 1000).toFixed(0)}m` : `${km.toFixed(1)} km`
        : '?';
      const name = el.tags?.name || el.tags?.['name:en'] || '';
      if (!name) return null;
      const nameLow = name.toLowerCase();
      const addr = [el.tags?.['addr:housenumber'], el.tags?.['addr:street']]
        .filter(Boolean).join(' ') || el.tags?.['addr:full'] || '';
      const hours = el.tags?.opening_hours || 'Call for hours';

      return {
        id: 'osm-' + el.id,
        name,
        dist,
        distNum: km || 999,
        addr,
        hours,
        ebt: ebtChains.some(c => nameLow.includes(c)),
        wic: wicChains.some(c => nameLow.includes(c)),
        lat: slat,
        lng: slng
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distNum - b.distNum)
    .slice(0, 12);

  return res.status(200).json({ stores });
}
