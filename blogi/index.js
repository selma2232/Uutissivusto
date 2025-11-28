const express = require('express');
const mysql = require('mysql2/promise');

const app = express();

const PORT = 3002;      
const HOST = 'localhost';


const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',         
    password: '',         
    database: 'blogi_db'  
});


app.get('/', (req, res) => {
    res.send('Blogi JSON -palvelin toimii. Kokeile /blogit');
});


app.get('/blogit', async (req, res) => {
    try {
       
        const [rows] = await pool.query(
            `SELECT k.kirjoitus_id,
                    k.otsikko,
                    k.teksti,
                    k.julkaisuaika,
                    k.blogi_id,
                    b.kirjoittaja
             FROM blogikirjoitus k
             JOIN blogi b ON k.blogi_id = b.blogi_id
             ORDER BY k.julkaisuaika DESC`
        );

        
        res.json(rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ virhe: 'Palvelinvirhe' });
    }
});

app.listen(PORT, HOST, () => {
    console.log(`${HOST}:${PORT} kuuntelee (blogit JSON)...`);
});
