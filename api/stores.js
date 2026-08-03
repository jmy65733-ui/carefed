export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lat, lng, radius = 3000 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  const apiKey = process.env.GOOGLE_PLACES_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=grocery_or_supermarket&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return res.status(200).json({ stores: [], error: data.status });
    }

    const ebtChains = ['h-e-b', 'heb', 'walmart', 'fiesta', 'aldi', 'kroger', 'randalls', 'whole foods', 'costco', 'target', 'sprouts', 'trader joe'];
    const wicChains = ['h-e-b', 'heb', 'walmart', 'kroger', 'randalls'];

    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);

    const stores = (data.results || []).map(place => {
      const slat = place.geometry.location.lat;
      const slng = place.geometry.location.lng;
      const km = Math.sqrt(
        Math.pow((slat - latN) * 111, 2) +
        Math.pow((slng - lngN) * 111 * Math.cos(latN * Math.PI / 180), 2)
      );
      const dist = km < 1 ? `${(km * 1000).toFixed(0)}m` : `${km.toFixed(1)} km`;
      const name = place.name;
      const nameLow = name.toLowerCase();
      const addr = place.vicinity || '';
      const isOpen = place.opening_hours?.open_now;
      const hours = isOpen === true ? 'Open now' : isOpen === false ? 'Closed now' : 'Hours not listed';
      const rating = place.rating ? `⭐ ${place.rating}` : '';

      return {
        id: 'gp-' + place.place_id,
        name,
        dist,
        distNum: km,
        addr,
        hours,
        rating,
        ebt: ebtChains.some(c => nameLow.includes(c)),
        wic: wicChains.some(c => nameLow.includes(c)),
        lat: slat,
        lng: slng
      };
    })
    .sort((a, b) => a.distNum - b.distNum)
    .slice(0, 12);

    return res.status(200).json({ stores });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
