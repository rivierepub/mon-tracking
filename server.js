// server.js
const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

const icaoHex = '39BE89'; // ★ remplace par l’ICAO24 de ton avion

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

  // Endpoint /avion -> avion en direct (JSON)
  if (path === '/avion') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    try {
      const aircraft = await fetchAircraft();
      const point = {
        lat: aircraft.lat || 0,
        lon: aircraft.lon || 0,
        heading: aircraft.track || 0,
        callsign: aircraft.call || 'AVION_X'
      };
      res.end(JSON.stringify(point));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'API avion indisponible' }));
    }
    return;
  }

  // Sert le HTML si / ou /index.html
  if (path === '/' || path === '/index.html') {
    const file = fs.readFileSync('index.html');
    res.setHeader('Content-Type', 'text/html');
    res.end(file);
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});