const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Optional: Explicitly serve index.html at the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Your existing API endpoint
app.get('/api/venues', (req, res) => {
  const venues = require('./data/stores.json');
  res.json(venues);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
