const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());












app.get('/', (req, res) => {
  res.send('The Language Academy Server is running...')
})

app.listen(port, () => {
  console.log(`The Language Academy Server is running on port ${port}`);
})