const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();
const port = 3000;

// Serve static files from the 'public' folder (located in backend/public)
app.use(express.static(path.join(__dirname, 'public')));

// Optional: Explicitly serve index.html at the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware to parse JSON bodies for REST API calls
app.use(express.json());

// Connect to MongoDB using environment variable or default
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/venuesdb';
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define a Mongoose schema and model for a Venue
const venueSchema = new mongoose.Schema({
  name: String,
  url: String,
  district: String
});
const Venue = mongoose.model('Venue', venueSchema);

// Optional: Seed the database if empty using the initial data from data/stores.json
(async () => {
  try {
    const count = await Venue.countDocuments({});
    if (count === 0) {
      const initialData = require('./data/stores.json');
      await Venue.insertMany(initialData);
      console.log('Seeded initial data');
    }
  } catch (err) {
    console.error('Error seeding data:', err);
  }
})();



// REST API Endpoints:

// GET: Return the list of venues
app.get('/api/venues', async (req, res) => {
  try {
    const venues = await Venue.find();
    res.json(venues);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching venues' });
  }
});

// POST: Add a new venue
app.post('/api/venues', async (req, res) => {
  try {
    const newVenue = new Venue(req.body);
    await newVenue.save();
    res.status(201).json(newVenue);
  } catch (err) {
    res.status(500).json({ error: 'Error adding venue' });
  }
});

// PUT: Update an existing venue by id
app.put('/api/venues/:id', async (req, res) => {
  try {
    const updatedVenue = await Venue.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (updatedVenue) {
      res.json(updatedVenue);
    } else {
      res.status(404).json({ error: 'Venue not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error updating venue' });
  }
});

// DELETE: Remove a venue by id
app.delete('/api/venues/:id', async (req, res) => {
  try {
    const deletedVenue = await Venue.findByIdAndDelete(req.params.id);
    if (deletedVenue) {
      res.json(deletedVenue);
    } else {
      res.status(404).json({ error: 'Venue not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error deleting venue' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
