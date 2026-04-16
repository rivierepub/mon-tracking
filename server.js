// server.js
const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

// 1. Récupère l'ICAO24 (hex) à partir de l'immatriculation via hexdb.io
function fetchHexFromReg(reg) {
  return new Promise((resolve, reject) => {
    const cleanReg = reg.trim().toUpperCase();
    const hexdbUrl = `https://hexdb.io/api/v1/aircraft/${cleanReg}`;

    const req = https.get(hexdbUrl, res => {
      let data = '';

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`hexdb.io: ${res.statusCode}`));
      }

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const obj = JSON.parse(data);
          if (obj && obj.ModeS) {
            resolve(obj.ModeS.toLowerCase()); // icoa24 (hex)
          } else {
            reject(new Error('aircraft not found'));
          }
        } catch (e) {
          console.error('hexdb.io JSON parse error:', data.slice(0, 200));
          reject(e);
        }
      });
    });

    req.on('error', err => {
      console.error('hexdb.io error:', err.message || err);
      reject(err);
    });

    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('hexdb.io request timeout'));
    });
  });
}

// 2. Récupère la position en temps réel via adsb.fi
function fetchAircraftFromHex(hex) {
  return new Promise((resolve, reject) => {
    const adsbUrl = `https://opendata.adsb.fi/api/v2/hex/${hex}`;

    const req = https.get(adsbUrl, res => {
      let data = '';

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`adsb.fi: ${res.statusCode}`));
      }

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const obj = JSON.parse(data);
          const acArray = obj.ac;

          if (Array.isArray(acArray) && acArray.length > 0) {
            resolve(acArray[0]);
          } else {
            reject(new Error('no aircraft data'));
          }
        } catch (e) {
          console.error('adsb.fi JSON parse error:', data.slice(0, 200));
          reject(e);
        }
      });
    });

    req.on('error', err => {
      console.error('adsb.fi error:', err.message || err);
      reject(err);
    });

    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('adsb.fi request timeout'));
    });
  });
}

// 3. Serveur HTTP principal
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;

  // 3.1 Endpoint /avion?reg=F-HPUJ → suivi par immatriculation
  if (path === '/avion') {
    const reg = parsed.query.reg;

    if (!reg) {
      res.statusCode = 400;
      return res.end('Missing reg');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    try {
      const icaoHex = await fetchHexFromReg(reg);
      const ac = await fetchAircraftFromHex(icaoHex);

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
        callsign: ac.flight?.trim() || ac.r || 'AVION_X',
        reg: ac.r || reg
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

  // 3.2 Sert la page web (index.html)
  if (path === '/' || path === '/index.html') {
    try {
      const file = fs.readFileSync('index.html');
      res.setHeader('Content-Type', 'text/html');
      res.end(file);
    } catch (err) {
      console.error('Lecture index.html:', err.message);
      res.statusCode = 500;
      res.end('Erreur serveur: index.html non trouvé');
    }
    return;
  }

  // 3.3 404 pour tout le reste
  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
