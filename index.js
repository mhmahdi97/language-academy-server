const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
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
    // await client.connect();

    const usersCollection = client.db("languageAcademyDb").collection("users");
    const courseCollection = client.db("languageAcademyDb").collection("courses");
    const selectedCourseCollection = client.db("languageAcademyDb").collection("selectedCourses");
    const enrolledCourseCollection = client.db("languageAcademyDb").collection("enrolledCourse");

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    
    // verify instructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }


    // users related apis

    // api to get all users
    app.get('/all-users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // api to get users by role to show instructors page
    app.get('/users', async (req, res) => {
      let query = {};
      if (req.query.role) {
        query = {role: req.query.role}
      }
    
      const result = await usersCollection.find(query).toArray();
      res.send(result)
    });

    // api to get user is admin or not
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })
    
    // api to get user is instructor or not
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })

    // api to store all users during registration and social login
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

    // api to make user an admin
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

    // api to make user an instructor
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

    // api to get all the courses by admin
    app.get('/all-courses', verifyJWT, verifyAdmin, async (req, res) => {
        const result = await courseCollection.find().toArray();
        res.send(result);
      });
      
    // api to get all the approved courses to use courses page
    app.get('/courses', async (req, res) => {
      let query = {};

      if (req.query.status) {
        query = {status: req.query.status}
      }
      
      const result = await courseCollection.find(query).toArray();
      res.send(result)
    });

    // api to get specific courses by id
    app.get('/courses/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await courseCollection.findOne(query);
      res.send(result);
    })

    // api to get all the courses added by specific instructor
    app.get('/instructor-courses', verifyJWT, verifyInstructor, async (req, res) => {
      let query = {};

      if (req.query.instructorEmail) {
        query = {instructorEmail: req.query.instructorEmail}
      }
      
      const result = await courseCollection.find(query).toArray();
      res.send(result)
    });

    // api to add new course by instructor
    app.post('/courses', async (req, res) => {
      const newCourse = req.body;
      const result = await courseCollection.insertOne(newCourse);
      res.send(result);
    })

    // api to approve new course by admin
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
    
    // api to deny new course by admin
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
    
    // api to give feedback denied courses by admin
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

    //  // api to decrease available seats
    // app.patch('/courses/approved/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const newSeats = req.body.newSeats;
    //   console.log(newSeats)
    //   const filter = { _id: new ObjectId(id) };
    //   const updateDoc = {
    //     $set: {
    //       availableSeats: newSeats
    //     },
    //   };

    //   const result = await courseCollection.updateOne(filter, updateDoc);
    //   res.send(result);
    // })


    // api to get selected courses by student
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
    
    // api to get enrolled courses by student
    app.get('/enrolled-courses', verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

      const query = { email: email };
      const result = await enrolledCourseCollection.find(query).toArray();
      res.send(result);
    });

    // api to select courses by student
     app.post('/selected-courses', async (req, res) => {
      const item = req.body;
      const result = await selectedCourseCollection.insertOne(item);
      res.send(result);
    });
    
    // api to get selected course by id
     app.get('/selected-course/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await selectedCourseCollection.findOne(query);
      res.send(result);
    });

    // api to delete a selected course by studend
    app.delete('/selected-courses/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCourseCollection.deleteOne(query);
      res.send(result);
    })


    // create payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { fixedPrice } = req.body;
      const amount = parseInt(fixedPrice * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payment related api
    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await enrolledCourseCollection.insertOne(payment);
      res.send(insertResult);
    })

    // api to update available seats and enrolled students by payment
    app.patch('/courses/update-seat/:id', async (req, res) => {
      const id = req.params.id;
      const newSeats = req.body.newSeats;
      const newEnrolled = req.body.newEnrolled;
      console.log(id);
      console.log(newSeats);
      console.log(newEnrolled);
      const updateSeatsFilter = { _id: new ObjectId(id) };
      const updateSeatsDoc = {
        $set: {
          availableSeats: newSeats
        },
      };
      const updateEnrolledFilter = { _id: new ObjectId(id) };
      const updateEnrolledDoc = {
        $set: {
          enrolled: newEnrolled
        },
      };

      const updateSeatsResult = await courseCollection.updateOne(updateSeatsFilter, updateSeatsDoc);
      const updateEnrolledResult = await courseCollection.updateOne(updateEnrolledFilter, updateEnrolledDoc);
      res.send({updateSeatsResult, updateEnrolledResult});
    })
    
   




    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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