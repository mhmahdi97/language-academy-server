const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}





// mongodb database
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cvqkxpy.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("languageAcademyDb").collection("users");
    const courseCollection = client.db("languageAcademyDb").collection("courses");
    const selectedCourseCollection = client.db("languageAcademyDb").collection("selectedCourses");

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })


    // users related apis
    app.get('/all-users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get('/users', async (req, res) => {
      let query = {};
      if (req.query.role) {
        query = {role: req.query.role}
      }
    
      const result = await usersCollection.find(query).toArray();
      res.send(result)
    });


    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })


    // courses related apis
    app.get('/all-courses', async (req, res) => {
      const result = await courseCollection.find().toArray();
      res.send(result);
    });

    app.get('/courses', async (req, res) => {
      let query = {};

      if (req.query.status) {
        query = {status: req.query.status}
      }
      
      const result = await courseCollection.find(query).toArray();
      res.send(result)
    });

    app.get('/courses/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await courseCollection.findOne(query);
      res.send(result);
    })

    app.get('/instructor-courses', async (req, res) => {
      let query = {};

      if (req.query.instructorEmail) {
        query = {instructorEmail: req.query.instructorEmail}
      }
      
      const result = await courseCollection.find(query).toArray();
      res.send(result)
    });

    app.post('/courses', async (req, res) => {
      const newCourse = req.body;
      const result = await courseCollection.insertOne(newCourse);
      res.send(result);
    })

    app.patch('/courses/approved/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'approved'
        },
      };

      const result = await courseCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    
    app.patch('/courses/denied/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'denied'
        },
      };

      const result = await courseCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    
    app.patch('/courses/feedback/:id', async (req, res) => {
      const id = req.params.id;
      const feedback = req.body.feedback;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: feedback
        },
      };

      const result = await courseCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    // selected courses related apis
    // app.get('/selected-courses', async (req, res) => {
    //   const result = await selectedCourseCollection.find().toArray();
    //   res.send(result);
    // });

    app.get('/selected-courses', verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

      const query = { email: email };
      const result = await selectedCourseCollection.find(query).toArray();
      res.send(result);
    });

     app.post('/selected-courses', async (req, res) => {
      const item = req.body;
      const result = await selectedCourseCollection.insertOne(item);
      res.send(result);
    });

    app.delete('/selected-courses/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCourseCollection.deleteOne(query);
      res.send(result);
    })








    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);








app.get('/', (req, res) => {
  res.send('The Language Academy Server is running...')
})

app.listen(port, () => {
  console.log(`The Language Academy Server is running on port ${port}`);
})