export default function handler(req, res) {
  const country_code = req.headers['x-vercel-ip-country'] || 'XX';
  const ip_address = req.headers['x-forwarded-for'] || 'Unknown';
  
  const isRussian = country_code === 'RU';
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  res.json({
    isRussian,
    country: country_code,
    ip: ip_address.split(',')[0],
    timestamp: new Date().toISOString(),
    confidence: country_code !== 'XX' ? 0.99 : 0.5
  });
}
