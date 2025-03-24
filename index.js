const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//middleware
app.use(
  cors({
    origin: [
      "http://localhost:5174",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());
app.use(cookieParser());

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ome3u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const uri = `${process.env.DB_URI}`


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "Unauthorized Access" });
  jwt.verify(token, process.env.JWT_SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    // Send a ping to confirm a successful connection
    const userCollection = client.db('ezyTicket').collection('users')
    const eventCollection = client.db('ezyTicket').collection('events')
    const busTicketCollection = client.db('ezyTicket').collection('bus_tickets')

    app.get("/", (req, res) => {
      res.send("EzyTicket server is Running");
    });

    //  -------------User API-------------
    app.post('/api/user', async (req, res) => {
      const user = res.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null })
      }
      const result = await userCollection.post(user);

      res.send(result);
    });
    /* --------------------------------------------------------------
                                JWT STARTS HERE
    -------------------------------------------------------------- */
    // working on jwt don't touch anything
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.JWT_SECRET_TOKEN, {
        expiresIn: "24hr",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // remove token from browser  cookie
    app.post("/logout", async (req, res) => {
      const user = req.body;
      res
        .clearCookie("token", { maxAge: 0, sameSite: "none", secure: true })
        .send({ success: true });
    });
    // jwt Related Work ends here don't touch anything jwt related code
    /* --------------------------------------------------------------
                                JWT ENDS HERE
    -------------------------------------------------------------- */

    // ------------Events API-------------
    app.get("/events", async (req, res) => {
      if (!eventCollection) {
        return res.status(500).send({ message: "Database not initialized" });
      }
      try {
        const events = await eventCollection.find({}).toArray();
        res.send(events);
      } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).send({ message: "Failed to fetch events", error });
      }
    });

    app.get("/events/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) }

      const result = await eventCollection.findOne(query);
      res.send(result);
    });

    // -------------Tavel API----------------

    app.get("/api/bus", async (req, res) => {
      const result = await busTicketCollection.find().toArray()
      res.send(result)
    })

    // search api 
    app.get("/api/stand", async (req, res) => {
      const { stand1, stand2 } = req.query; 
        if (!stand1 || !stand2) {
            return res.status(400).json({ message: "Both stand1 and stand2 are required" });
        }
        const allBus = await busTicketCollection.find().toArray();
        const result = allBus.filter(bus =>
          bus.from.includes(stand1) && bus.to.includes(stand2)
        );
        res.send(result); 
    })
    // -------------Tavel API End----------------

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error.
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`EzyTicket is running on ${port}`);
});
