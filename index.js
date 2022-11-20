const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');


// middleware
app.use(cors());
app.use(express.json());


app.get('/', (req, res)=> {
    res.send('doctor protal server is running')
})



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.URI_NAME}:${process.env.URI_PASS}@cluster0.cn0mdvb.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT (req, res, next){
  const authHeader = req.headers.authorization;
  if(!authHeader){
    return res.status(401).send('unathorization access token')
  }
  const token = authHeader.split(' ')[1];
  // console.log(token)
  jwt.verify(token, process.env.JWT_TOKEN, function(err, decoded){
    if(err){
      return res.status(403).send('forbidden users')
    }
    req.decoded= decoded;
    next()
  }) 

}

async function run() {
    try {
      const appointmentCollection = client.db("doctor_Portal").collection('appointmentOptions');
      const bookingsCollection = client.db("doctor_Portal").collection('bookings');
      const usersCollection = client.db("doctor_Portal").collection('users');
      const doctorsCollection = client.db("doctor_Portal").collection('doctors');


      // NOTE: MAKE SURE YOU USE VerifyAdmin after verifyJWT 
      const verifyAdmin = async(req, res, next)=> {
        const decodedEmail = req.decoded.email;
        console.log(decodedEmail);
          next()
      }



      // ==========JWT TOKEN USERS =========//
      app.get('/jwt', async(req, res)=> {
        const email = req.query.email;
        const query = {email: email};
        const user = await usersCollection.findOne(query);
        // console.log(user)
        if(user){
          const token = jwt.sign({email}, process.env.JWT_TOKEN, {expiresIn: '1h'})
          return res.send({accessToken: token})
        }
        return res.status(403).send({accessToken: 'token'})
      })



      app.get('/appointmentSpecialty', async(req, res)=> {
        const query = {};
        const result = await appointmentCollection.find(query).project({name: 1 }).toArray();
        res.send(result)
      })


      
      app.get('/appoinments', async(req, res)=> {
        const date = req.query.date;
        // console.log(date)
        const query = {};
        const options = await appointmentCollection.find(query).toArray();

        const bookingQuery = {appointmentDate: date}
        const alreadyBook = await bookingsCollection.find(bookingQuery).toArray();
        
        options.forEach(option=> {
          const optionBooked = alreadyBook.filter(book=> book.treatment === option.name);
          const bookedSlots = optionBooked.map(book=> book.slot)
          console.log(option.name, bookedSlots)
          const remainingSlots = option.slots.filter(slot=> !bookedSlots.includes(slot));
          option.slots= remainingSlots
        })
        // console.log(alreadyBook)
        res.send(options)
      })




      //================== bookings ====================//

      app.get('/bookings',verifyJWT, async(req, res)=> {
        const email = req.query.email;
        const decodedEmail =(req.decoded.email);
        // if(decodedEmail !== email){
        //   res.status(403).send({message: 'Forbidden access token'})
        // }
          const query = {email: email};
          const result = await bookingsCollection.find(query).toArray();
          res.send(result)
      })
      

      app.post('/bookings', async(req, res)=> {
        const booking = req.body;
        // console.log(booking);
        const query = {
          appointmentDate: booking.appointmentDate,
          email: booking.email,
          treatment: booking.treatment
        }

        const alreadyBooked = await bookingsCollection.find(query).toArray();
        if(alreadyBooked.length){
          const message = `you already have a booking on ${booking.appointmentDate}`;
          return res.send({acknowleged: false, message})
        }

        const result = await bookingsCollection.insertOne(booking);
        res.send(result)
      })


      // ======= saveduser in database==== //


      app.get('/users/admin/:email', async(req, res)=> {
        const email = req.params.email;
        const query = {email};
        const user = await usersCollection.findOne(query);
        res.send({isAdmin: user?.role === 'admin'})
      })


      app.get('/users', async(req, res)=> {
        const query = {};
        const result = await usersCollection.find(query).toArray();
        res.send(result)
      })

      app.post('/users', async(req, res)=> {
        const userInfo = req.body;
        const result = await usersCollection.insertOne(userInfo);
        res.send(result)
      })

      app.put('/users/admin/:id', verifyJWT, async(req, res)=> {

        const decodedEmail = req.decoded.email;
        const query = {email: decodedEmail};
        const user = await usersCollection.findOne(query);

        if(user?.role !== 'admin'){
          return res.status(403).send({message: 'forbidden access'})
        }

        const id = req.params.id;
        const filter = {_id: ObjectId(id)};
        const option = {upsert: true};
        const updateDoc = {
          $set: {
            role: 'admin'
          }
        }
        const result = await usersCollection.updateOne(filter, updateDoc, option);
        res.send(result)

      })


      // doctors data to the database added

      app.get('/doctors', async(req, res)=> {
        const query = {};
        const result = await doctorsCollection.find(query).toArray();
        res.send(result)
      })


      app.post('/doctors', verifyJWT, async(req, res)=> {
        const doctor = req.body;
        const result = await doctorsCollection.insertOne(doctor);
        res.send(result)
      })

      app.delete('/doctors/:id', verifyJWT, async(req, res)=> {
        const id = req.params.id;
        const filter = {_id: ObjectId(id)};
        const result = await doctorsCollection.deleteOne(filter);
        res.send(result)
      })

     
      
    } finally {(error)=> {
        console.log(error)
    }}
  }
  run().catch(console.dir);


app.listen(port, ()=> {
    console.log('doctor protal server is running', port)
})