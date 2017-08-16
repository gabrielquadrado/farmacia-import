'use strict';

const express = require('express');
const app = express();

const PORT = 3000;
const HOST = 'localhost';

app.get('/', (req, res) => {
  res.send('Hello world\n');
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);