require("dotenv").config();
const express = require("express");
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
      // "https://ezy-tricket.firebaseapp.com",
      // "https://ezy-tricket.web.app",
      "https://ezyticket-7198b.web.app",
      "https://ezyticket-7198b.firebaseapp.com",
      "https://ezy-ticket-server.vercel.app",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());
app.use(cookieParser());

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ome3u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const uri = `${process.env.DB_URI}`;

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
    // await client.connect();
    // Send a ping to confirm a successful connection
    const userCollection = client.db("ezyTicket").collection("users");
    const eventCollection = client.db("ezyTicket").collection("events");
    const busTicketCollection = client
      .db("ezyTicket")
      .collection("bus_tickets");
    const movieTicketCollection = client
      .db("ezyTicket")
      .collection("movie_tickets");
    const MyWishListCollection = client
      .db("ezyTicket")
      .collection("mywishlist");

    app.get("/", (req, res) => {
      res.send("EzyTicket server is Running");
    });

    //  -------------User API-------------
    app.post("/api/user", async (req, res) => {
      const user = res.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
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

    //  -------------User API-------------
    app.post("/api/user", async (req, res) => {
      const user = res.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await userCollection.post(user);

      res.send(result);
    });

    // check Admin
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log(email)
      if (email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // Check Manager
    app.get("/users/manager/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log(email)
      if (email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let manager = false;
      if (user) {
        manager = user?.role === "manager";
      }
      res.send({ manager });
    });

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
      const query = { _id: new ObjectId(id) };

      const result = await eventCollection.findOne(query);
      res.send(result);
    });

    //------------MyWishListAPI--------------

    //added wishlist api
    app.post("/wishlist", async (req, res) => {
      try {
        const wishlist = req.body;

        const existingItem = await MyWishListCollection.findOne({
          eventId: wishlist.eventId,
          userEmail: wishlist.userEmail,
        });

        if (existingItem) {
          return res
            .status(400)
            .send({ message: "Event is already in your wishlist" });
        }

        const result = await MyWishListCollection.insertOne(wishlist);
        res.send(result);
      } catch (error) {
        console.error("Event saving to wishlist:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });
    app.delete("/wishlist/:email/:eventId", async (req, res) => {
      const { email, eventId } = req.params;
      try {
        const result = await wishlistCollection.deleteOne({
          userEmail: email,
          eventId: eventId,
        });
        if (result.deletedCount === 1) {
          res.status(200).json({ message: "Event removed from wishlist" });
        } else {
          res.status(404).json({ message: "Event not found in wishlist" });
        }
      } catch (error) {
        console.error("Error removing event from wishlist:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Modify the /wishlist route to include token verification
    app.get("/wishlist", verifyToken, async (req, res) => {
      try {
        const userEmail = req.user.email; // Use the decoded user email from the token
        if (!userEmail) {
          return res.status(400).send({ message: "User email is required" });
        }
        const wishlistItems = await MyWishListCollection.find({
          userEmail,
        }).toArray();

        res.send(wishlistItems);
      } catch (error) {
        console.error("Error fetching wishlist:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    //------------MyWishListAPI--------------

    // -------------Tavel API---------------------

    app.get("/api/bus", async (req, res) => {
      const result = await busTicketCollection.find().toArray();
      res.send(result);
    });

    // search api
    app.get("/api/stand", async (req, res) => {
      const { stand1, stand2 } = req.query;
      if (!stand1 || !stand2) {
        return res
          .status(400)
          .json({ message: "Both stand1 and stand2 are required" });
      }
      const allBus = await busTicketCollection.find().toArray();
      const result = allBus.filter(
        (bus) => bus.from.includes(stand1) && bus.to.includes(stand2)
      );
      res.send(result);
    });
    // -------------Tavel API End----------------

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error.
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`EzyTicket is running on ${port}`);
});
