
const express = require('express');
const { XMLBuilder } = require('fast-xml-parser');
const mysql = require('mysql2/promise');

const app = express();

const port = 3001;   
const host = 'localhost';


const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',        
    database: 'saa_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

(async () => {
    try {
        const conn = await pool.getConnection();
        await conn.query('SELECT 1');
        conn.release();
        console.log('Osa 1: MySQL-yhteys OK (saa_db)');
    } catch (err) {
        console.error('Osa 1: MySQL-yhteys EI toimi:', err);
    }
})();


app.get('/', (req, res) => {
    res.send('Sää XML -palvelin toimii. Käytä esim. /saa/21');
});


app.get('/saa/:vko', async (req, res) => {
    const viikko = req.params.vko;

    try {
        const [rivit] = await pool.query(
            'SELECT pvm, saatila, lampotila, tuulennopeus FROM saa WHERE vko = ? ORDER BY pvm',
            [viikko]
        );

        const paivat = rivit.map(r => ({
            pvm: r.pvm.toISOString().slice(0, 10),
            saatila: r.saatila,
            lampotila: r.lampotila,
            tuulennopeus: r.tuulennopeus
        }));

        const rakentaja = new XMLBuilder({
            arrayNodeName: 'paiva'
        });

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<saa>
    <viikko>${viikko}</viikko>
    ${rakentaja.build(paivat)}
</saa>`;

        res.set('Content-Type', 'text/xml');
        res.send(xml);

    } catch (err) {
        console.error('Virhe säätietojen haussa:', err);
        res.status(500).send('Virhe säätietojen haussa.');
    }
});

app.listen(port, host, () => console.log(`${host}:${port} kuuntelee (sää)...`));
