// server.js
const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

const icaoHex = '39BE89'; // ★ change ici si besoin

function fetchAircraft() {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://opendata.adsb.fi/api/v2/hex/${icaoHex}`,
      res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
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
      const aircraft = await fetchAircraft();

      // Vérifie que lat/lon sont bien des nombres non nuls
      if (
        aircraft.lat == null ||
        aircraft.lon == null ||
        typeof aircraft.lat !== 'number' ||
        typeof aircraft.lon !== 'number'
      ) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Pas de position valide' }));
      }
      console.log('Avion reçu:', { lat: aircraft.lat, lon: aircraft.lon });
      const point = {
        lat: aircraft.lat,
        lon: aircraft.lon,
        heading: aircraft.track || 0,
        callsign: aircraft.call || 'AVION_X'
      };
      res.end(JSON.stringify(point));
      
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
