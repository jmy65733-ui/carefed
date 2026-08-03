export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { lat, lng, radius = 2000 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
  try {
    const query = `[out:json][timeout:15];(node["shop"~"supermarket|grocery|convenience"](around:${radius},${lat},${lng});way["shop"~"supermarket|grocery"](around:${radius},${lat},${lng}););out center;`;
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`
    });
    const data = await response.json();
    const ebtChains = ['h-e-b','heb','walmart','fiesta','aldi','kroger','randalls','whole foods'];
    const wicChains = ['h-e-b','heb','walmart','kroger','randalls'];
    const stores = data.elements.map(el => {
      const slat = el.lat || el.center?.lat;
      const slng = el.lon || el.center?.lon;
      const km = slat && slng ? Math.sqrt(Math.pow((slat-lat)*111,2)+Math.pow((slng-lng)*111*Math.cos(lat*Math.PI/180),2)) : null;
      const dist = km ? km<1 ? `${(km*1000).toFixed(0)}m` : `${km.toFixed(1)} km` : '?';
      const name = el.tags?.name || 'Grocery Store';
      const addr = [el.tags?.['addr:housenumber'],el.tags?.['addr:street']].filter(Boolean).join(' ') || '';
      const hours = el.tags?.opening_hours || 'Hours not listed';
      return { id:'osm-'+el.id, name, dist, distNum:km||999, addr, hours, ebt:ebtChains.some(c=>name.toLowerCase().includes(c)), wic:wicChains.some(c=>name.toLowerCase().includes(c)), lat:slat, lng:slng };
    }).filter(s=>s.name!=='Grocery Store'||s.addr).sort((a,b)=>a.distNum-b.distNum).slice(0,10);
    return res.status(200).json({ stores });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
