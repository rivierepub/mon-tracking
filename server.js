// server.js
const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

const icaoHex = '3949F7'; // ★ à adapter si besoin

function fetchAircraft() {
  return new Promise((resolve, reject) => {
    const url = `https://opendata.adsb.fi/api/v2/hex/${icaoHex}`;
    const req = https.get(url, res => {
      let data = '';

      // Ajouter statusCode pour comprendre les erreurs
      if (res.statusCode !== 200) {
        const err = new Error(`adsb.fi: ${res.statusCode}`);
        res.resume(); // drain response
        return reject(err);
      }

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const obj = JSON.parse(data);
          resolve(obj);
        } catch (e) {
          console.error('JSON parse error:', data.slice(0, 200));
          reject(e);
        }
      });
    });

    req.on('error', err => {
      console.error('https.get error:', err.message || err);
      reject(err);
    });

    req.setTimeout(8000, () => {
      req.destroy();
      const err = new Error('Request timeout');
      console.error('Request timeout');
      reject(err);
    });
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

      if (
        ac.lat == null ||
        ac.lon == null ||
        typeof ac.lat !== 'number' ||
        typeof ac.lon !== 'number'
      ) {
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
      res.end(JSON.stringify({ error: 'API avion indisponible', details: e.message }));
    }

    return;
  }

  if (path === '/' || path === '/index.html') {
    try {
      const file = fs.readFileSync('index.html');
      res.setHeader('Content-Type', 'text/html');
      res.end(file);
    } catch (err) {
      console.error('Lecture index.html:', err.message);
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
