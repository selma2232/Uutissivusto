
const express = require('express');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const mysql = require('mysql2/promise');
const fetch = (...args) =>
    import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();

const port = 3003;
const host = 'localhost';

const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'uutiset_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


(async () => {
    try {
        const conn = await pool.getConnection();
        await conn.query('SELECT 1');
        conn.release();
        console.log('Osa 3: MySQL-yhteys OK (uutiset_db)');
    } catch (err) {
        console.error('Osa 3: MySQL-yhteys EI toimi:', err);
    }
})();



app.get('/', async (req, res) => {
    
    const viikko = 21;

    let saa = [];
    let blogit = [];
    let uutiset = [];

   
    const saaUrl = `http://localhost:3001/saa/${viikko}`;
    const asetukset = { method: 'GET' };

    try {
        const haettuSivu = await fetch(saaUrl, asetukset);
        const xml = await haettuSivu.text();

        const validia = XMLValidator.validate(xml);
        if (validia) {
            const parseri = new XMLParser();
            const data = parseri.parse(xml);  

            if (data.saa && data.saa.paiva) {
                saa = Array.isArray(data.saa.paiva)
                    ? data.saa.paiva
                    : [data.saa.paiva];
            }
        } else {
            console.log('Virheellinen XML-syöte (sää).');
        }

    } catch (err) {
        console.log('Virhe säätietojen haussa:', err);
        saa = [];
    }

    
    try {
        const blogiUrl = 'http://localhost:3002/blogit';
        const haettu = await fetch(blogiUrl);
        blogit = await haettu.json();
    } catch (err) {
        console.log('Virhe blogien haussa:', err);
        blogit = [];
    }

   
    try {
        const [rows] = await pool.query(
            `SELECT uutinen_id, otsikko, julkaisuaika, kirjoittaja, sisalto, paauutinen
             FROM uutiset
             ORDER BY julkaisuaika DESC`
        );
        uutiset = rows;
    } catch (err) {
        console.log('Virhe uutisten haussa:', err);
        uutiset = [];
    }

    const paauutiset = uutiset.filter(u => u.paauutinen === 1);
    const muutUutiset = uutiset.filter(u => u.paauutinen === 0);

    const vierailevat = [];
    for (const b of blogit) {
        if (b.kirjoittaja && !vierailevat.includes(b.kirjoittaja)) {
            vierailevat.push(b.kirjoittaja);
        }
    }

    let saaHtml = '';
    for (let paiva of saa) {
        saaHtml += `
            <div class="saa-paiva">
                <div><strong>${paiva.pvm}</strong></div>
                <div class="saa-lampo">${paiva.lampotila} °C</div>
                <div>${paiva.saatila}</div>
                <div>Tuuli: ${paiva.tuulennopeus} m/s</div>
            </div>
        `;
    }

    const html = `
<!DOCTYPE html>
<html lang="fi">
<head>
    <meta charset="UTF-8">
    <title>Satuvaltakunnan tarinat</title>
    <style>
        body { font-family: Arial, sans-serif; background-color: #ffe6f7; }
        .page { width: 900px; margin: 20px auto; background-color: #fff; border: 3px solid #cc0099; }
        header { text-align: center; padding: 15px; background-color: #ffcccc; border-bottom: 3px solid #cc0099; }
        header h1 { margin: 0; }
        header h2 { margin: 5px 0 0 0; font-style: italic; }
        .saa { background-color: #ff99ff; padding: 10px; border-bottom: 3px solid #cc0099;
               display: flex; gap: 10px; }
        .saa-paiva { background-color: #fff; border: 1px solid #cc0099; padding: 5px;
                     min-width: 120px; text-align: center; font-size: 12px; }
        .saa-lampo { font-size: 18px; font-weight: bold; }
        .content { display: flex; padding: 10px; }
        .main-news { flex: 3; padding-right: 10px; border-right: 2px solid #cc0099; }
        .sidebars { flex: 2; padding-left: 10px; }
        .uutinen { margin-bottom: 20px; }
        .uutinen h3 { margin-bottom: 5px; }
        .meta { font-size: 12px; color: #555; margin-bottom: 5px; }
        .box { margin-bottom: 20px; border: 2px solid #cc0099; background-color: #ffccf2; }
        .box h3 { margin: 0; padding: 5px; background-color: #ff99ff;
                  border-bottom: 2px solid #cc0099; font-size: 14px; }
        .box ul { list-style: none; padding: 5px 10px; margin: 0; font-size: 13px; }
        .box ul li { margin-bottom: 5px; }
    </style>
</head>
<body>
<div class="page">
    <header>
        <h1>Satuvaltakunnan tarinat</h1>
        <h2>Uutisia lumotusta maasta</h2>
    </header>

    <section class="saa">
        ${saa.length === 0 ? '<div>Ei säätietoja saatavilla.</div>' : saaHtml}
    </section>

    <div class="content">
        <section class="main-news">
            ${paauutiset.map(u => `
                <article class="uutinen">
                    <h3>${u.otsikko}</h3>
                    <div class="meta">
                        ${u.julkaisuaika || ''} | ${u.kirjoittaja || '' }
                    </div>
                    <div>${u.sisalto.replace(/\\r\\n/g, '<br>')}</div>
                </article>
            `).join('')}
        </section>

        <aside class="sidebars">
            <div class="box">
                <h3>Uusimmat uutiset</h3>
                <ul>
                    ${
                        muutUutiset.length === 0
                            ? '<li>Ei muita uutisia.</li>'
                            : muutUutiset.map(u => `
                                <li>
                                    <strong>${u.otsikko}</strong><br>
                                    <span style="font-size:11px;">${u.julkaisuaika || ''}</span>
                                </li>
                            `).join('')
                    }
                </ul>
            </div>

            <div class="box">
                <h3>Vierailevat kirjoittajat</h3>
                <ul>
                    ${
                        vierailevat.length === 0
                            ? '<li>Ei kirjoittajia.</li>'
                            : vierailevat.map(nimi => `<li>${nimi}</li>`).join('')
                    }
                </ul>
            </div>
        </aside>
    </div>
</div>
</body>
</html>
`;

    res.send(html);
});

app.listen(port, host, () => console.log(`${host}:${port} kuuntelee (uutissivusto)...`));
