// server.js
const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

const icaoHex = '39BE89'; // ★ à adapter si besoin

function fetchAircraft() {
  return new Promise((resolve, reject) => {
    const url = `https://opendata.adsb.fi/api/v2/hex/${icaoHex}`;
    const req = https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const obj = JSON.parse(data);
          resolve(obj);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;

  if (path === '/avion') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    try {
      const jsonObj = await fetchAircraft();
      const acArray = jsonObj.ac;

      if (!Array.isArray(acArray) || acArray.length === 0) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Aucun avion trouvé' }));
      }

      const ac = acArray[0];

      if (ac.lat == null || ac.lon == null || typeof ac.lat !== 'number' || typeof ac.lon !== 'number') {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Pas de position valide' }));
      }

      const point = {
        lat: ac.lat,
        lon: ac.lon,
        heading: ac.track || 0,
        callsign: ac.flight?.trim() || ac.r || 'AVION_X'
      };

      res.statusCode = 200;
      return res.end(JSON.stringify(point));
    } catch (e) {
      console.error('Erreur avion:', e.message || e);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'API avion indisponible' }));
    }

    return;
  }

  if (path === '/' || path === '/index.html') {
    try {
      const file = fs.readFileSync('index.html');
      res.setHeader('Content-Type', 'text/html');
      res.end(file);
    } catch (err) {
      res.statusCode = 500;
      res.end('Erreur serveur');
    }
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
