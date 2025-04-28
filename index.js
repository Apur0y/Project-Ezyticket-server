require("dotenv").config();
const express = require("express");
const cors = require("cors");
const SSLCommerzPayment = require("sslcommerz-lts");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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

//ezyticket
//ceIzda5WkyaCgaJy

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ome3u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const uri = `${process.env.DB_URI}`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false; //true for live, false for sandbox

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
    const eventReviewCollection = client
      .db("ezyTicket")
      .collection("event_review");
    const busTicketCollection = client
      .db("ezyTicket")
      .collection("bus_tickets");
    const movieTicketCollection = client
      .db("ezyTicket")
      .collection("movie_tickets");
    const MyWishListCollection = client
      .db("ezyTicket")
      .collection("mywishlist");
    const orderCollection = client.db("ezyTicket").collection("orders");
    const cinemaHallCollection = client
      .db("ezyTicket")
      .collection("cinemahalls");
    const moviesCollection = client.db("ezyTicket").collection("allMovies");
    const busServiceCollection = client
      .db("ezyTicket")
      .collection("busServices");
    const busPaymentCollection = client
      .db("ezyTicket")
      .collection("busPayments");
    const busFlashDealCollection = client
      .db("ezyTicket")
      .collection("travelFlashDeals");

    app.get("/", (req, res) => {
      res.send("EzyTicket server is Running");
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
    //  Save user info to database when user login
    app.post("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email };
      // check if user exists
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }
      const result = await userCollection.insertOne({
        ...user,
        timestamp: Date.now(),
      });
      res.send(result);
    });

    //--------------- Common API -------------
    // ------------SSLCOMMERZE API----------
    const tran_id = new ObjectId().toString(); //Creates a unique id for transaction
    app.post("/order", async (req, res) => {
      const order = req.body;
      const data = {
        total_amount: order.price,
        currency: "BDT",
        tran_id: tran_id, // use unique tran_id for each api call
        success_url: `${process.env.server}/payment/success/${tran_id}`,
        fail_url: `${process.env.server}/payment/fail/${tran_id}`,
        cancel_url: "http://localhost:3000/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "tickets",
        product_profile: "general",
        cus_name: order.name,
        cus_email: order.email,
        cus_add1: order.address,
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: order.phone,
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        console.log("API Response:", apiResponse);
        // Redirect the user to payment gateway system
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });

        const paymentTime = new Date().toLocaleString("en-BD", {
          timeZone: "Asia/Dhaka",
          hour12: true,
        });

        const finalOrder = {
          order,
          paidStatus: false,
          transactionId: tran_id,
          paymentTime: paymentTime,
        };
        const result = orderCollection.insertOne(finalOrder);

        console.log("Redirecting to: ", GatewayPageURL);
      });
    });

    //Successful Payment
    app.post("/payment/success/:tran_id", async (req, res) => {
      console.log(req.params.tran_id);
      const result = await orderCollection.updateOne(
        { transactionId: req.params.tran_id },
        {
          $set: {
            paidStatus: true,
          },
        }
      );

      if (result.modifiedCount > 0) {
        res.redirect(
          `${process.env.client}/payment/success/${req.params.tran_id}`
        );
      }
    });

    //Failed Payment
    app.post("/payment/fail/:tran_id", async (req, res) => {
      const result = await orderCollection.deleteOne({
        transactionId: req.params.tran_id,
      });
      if (result.deletedCount) {
        res.redirect(
          `${process.env.client}/payment/fail/${req.params.tran_id}`
        );
      }
    });

    //Get Order using transaction Id
    app.get("/order/:id", async (req, res) => {
      const transactionId = req.params.id;
      const query = { transactionId: transactionId };
      const result = await orderCollection.findOne(query);
      res.send(result);
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

    //get all users
    app.get("/users", async (req, res) => {
      try {
        const users = await userCollection.find().toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ message: "Error fetching users" });
      }
    });

    //get current userInfo
    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.find(query).toArray();
      res.send(user);
    });

    // Update user role.
    app.patch("/users/role/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { role } = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: role,
          },
        };

        const result = await userCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount > 0) {
          res.json({
            message: "User role updated successfully",
            modifiedCount: result.modifiedCount,
          });
        } else {
          res.status(404).json({ message: "User not found or role unchanged" });
        }
      } catch (error) {
        res.status(500).json({ message: "Failed to update role", error });
      }
    });

    // Delete User
    app.delete("/users/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);

        if (result.deletedCount > 0) {
          res.json({
            message: "User deleted Successfully",
            deletedCount: result.deletedCount,
          });
        } else {
          res.status(404).json({ message: "User not found" });
        }
      } catch (error) {
        res.status(500).json({ message: "Failed to delete user", error });
      }
    });

    //Update User Profile
    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      const updateData = req.body;
      const filter = { email: email };
      const updateDoc = {
        $set: {
          email: updateData.email,
          name: updateData.name,
          phone: updateData.phone,
          address: updateData.address,
        },
      };
      // Update user in database
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // -------------User API ends --------------------

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

    // ------------------Check Event Manager--------------------
    app.get("/users/eventManager/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log(email)
      if (email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let eventManager = false;
      if (user) {
        eventManager = user?.role === "eventManager";
      }
      res.send({ eventManager });
    });

    // -----------------Check Travel Manager------------------
    app.get("/users/travelManager/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log(email)
      if (email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let travelManager = false;
      if (user) {
        travelManager = user?.role === "travelManager";
      }
      res.send({ travelManager });
    });

    // ----------------Check Entertainment Manager--------------
    app.get(
      "/users/entertainmentManager/:email",
      verifyToken,
      async (req, res) => {
        const email = req.params.email;
        // console.log(email)
        if (email !== req.user.email) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const query = { email: email };
        const user = await userCollection.findOne(query);
        let entertainmentManager = false;
        if (user) {
          entertainmentManager = user?.role === "entertainmentManager";
        }
        res.send({ entertainmentManager });
      }
    );

    //--------------Entertainment API -------------

    app.post("/movie_tickets", async (req, res) => {
      try {
        const data = req.body;
        const result = await movieTicketCollection.insertOne(data);
        res.send(result);
      } catch (error) {
        console.error(error.message);
      }
    });

    app.get("/movie_tickets", async (req, res) => {
      const result = await movieTicketCollection.find().toArray();
      res.send(result);
    });

    app.post("/cinemahalls", async (req, res) => {
      try {
        const data = req.body;
        const result = await cinemaHallCollection.insertOne(data);
        res.send(result);
      } catch (error) {
        console.error(error.message);
      }
    });

    app.get("/cinemahalls", async (req, res) => {
      const result = await cinemaHallCollection.find().toArray();
      res.send(result);
    });

    // delete a cinema hall
    app.delete("/cinemahalls/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cinemaHallCollection.deleteOne(query);
      res.send(result);
    });
    // get a specific cinema hall by id
    app.get("/cinemahalls/:id", async (req, res) => {
      const id = req.params.id;
      const hall = await cinemaHallCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(hall);
    });

    // update a specific cinema hall data in the database
    app.patch("/allhalls/:id", async (req, res) => {
      const id = req.params.id;
      const updatedHall = req.body;

      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            name: updatedHall.name,
            location: updatedHall.location,
            totalSeats: updatedHall.totalSeats,
            price: updatedHall.price,
            facilities: updatedHall.facilities,
            email: updatedHall.email,
            image: updatedHall.image,
          },
        };

        const result = await cinemaHallCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating hall:", error.message);
        res.status(500).send({ error: "Failed to update hall" });
      }
    });

    app.post("/allmovies", async (req, res) => {
      try {
        const movie = req.body;
        const result = await moviesCollection.insertOne(movie);
        res.send(result);
      } catch (error) {
        console.error(error.message);
      }
    });

    app.get("/allmovies", async (req, res) => {
      const result = await moviesCollection.find().toArray();
      res.send(result);
    });

    app.delete("/allmovies/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await moviesCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/allmovies/:id", async (req, res) => {
      const id = req.params.id;
      const movie = await moviesCollection.findOne({ _id: new ObjectId(id) });
      res.send(movie);
    });
    // update a specific movie data in the database
    app.patch("/allmovies/:id", async (req, res) => {
      const id = req.params.id;
      const updatedMovie = req.body;

      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            name: updatedMovie.name,
            description: updatedMovie.description,
            duration: updatedMovie.duration,
            category: updatedMovie.category,
            genre: updatedMovie.genre,
            actors: updatedMovie.actors,
            releaseDate: updatedMovie.releaseDate,
            language: updatedMovie.language,
            director: updatedMovie.director,
            imageLink: updatedMovie.imageLink,
            cinemaHalls: updatedMovie.cinemaHalls,
          },
        };

        const result = await moviesCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating movie:", error.message);
        res.status(500).send({ error: "Failed to update movie" });
      }
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

    // Advertise event api
    app.get("/topEvents", async (req, res) => {
      if (!eventCollection) {
        return res.status(500).send({ message: "Database not initialized" });
      }
      try {
        const events = await eventCollection.find({ advertise: true }).toArray();
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

    app.get("/myAddedEvents/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { managerEmail: email };
      const events = await eventCollection.find(query).toArray();
      res.send(events);
    });

    app.post("/events", async (req, res) => {
      const event = req.body;
      const result = await eventCollection.insertOne(event);
      res.send(result);
    });

    app.patch("/verifyEvent/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const event = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: event.status,
        },
      };
      const result = await eventCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/events/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const event = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          title: event.title,
          eventType: event.eventType,
          eventDate: event.eventDate,
          eventTime: event.eventTime,
          duration: event.duration,
          price: event.price,
          totalTickets: event.totalTickets,
          location: event.location,
          details: event.details,
        },
      };
      const result = await eventCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/events/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await eventCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/event-reviews", async (req, res) => {
      const {
        eventId,
        eventName,
        comment,
        customerEmail,
        customerName,
        customerPhoto,
        time,
        category,
        status,
      } = req.body;

      if (!eventId || !comment || !customerEmail) {
        return res.status(400).send({ message: "Missing required fields" });
      }

      try {
        const review = {
          eventId: new ObjectId(eventId),
          comment,
          eventName,
          customerEmail,
          customerName,
          customerPhoto,
          time,
          category,
          status,
          createdAt: new Date(),
        };

        const result = await eventReviewCollection.insertOne(review);
        res.status(201).send(result);
      } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).send({ message: "Failed to add comment" });
      }
    });
    app.get("/event-reviews", async (req, res) => {
      if (!eventReviewCollection) {
        return res.status(500).send({ message: "Database not initialized" });
      }
      try {
        const events = await eventReviewCollection.find({}).toArray();
        res.send(events);
      } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).send({ message: "Failed to fetch events", error });
      }
    });

    // Example Express route
    app.patch("/verifyEvent/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: req.body.status, // should be 'verified'
        },
      };
      const result = await eventReviewsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Delete a review
    app.delete("/event-reviews/:id", async (req, res) => {
      const id = req.params.id;
      const result = await eventReviewCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // ---------------Events API ends ------------------------
    app.post("/wishlist", async (req, res) => {
      try {
        const wishlist = req.body;

        // Check if event already exists in wishlist
        const existingItem = await MyWishListCollection.findOne({
          eventId: wishlist.eventId,
          userEmail: wishlist.userEmail,
        });

        if (existingItem) {
          return res
            .status(400)
            .send({ message: "Event is already in your wishlist" });
        }

        // Insert event into wishlist
        const result = await MyWishListCollection.insertOne(wishlist);
        res.status(200).send(result);
      } catch (error) {
        console.error("Error saving to wishlist:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // DELETE from wishlist
    app.delete("/wishlist/:email/:eventId", async (req, res) => {
      const { email, eventId } = req.params;
      try {
        const result = await MyWishListCollection.deleteOne({
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

    // GET wishlist with authentication
    app.get("/wishlist/:email", async (req, res) => {
      try {
        const userEmail = req.params.email;
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
    //  added bus ticket booking
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

    app.post("/payment-bus-ticket", async (req, res) => {
      const paymentData = req.body;
      console.log(paymentData);
      const result = await busPaymentCollection.insertOne(paymentData);
      //  update bus post
      const query = { _id: new ObjectId(paymentData.busPostId) };
      const findPost = await busTicketCollection.findOne(query);
      const previousSeat = findPost?.bookedSeats;
      const newSeat = paymentData.selectedSeats;
      let allSeat = newSeat;
      if (previousSeat) {
        allSeat = [...previousSeat, ...newSeat];
      }
      const updateResult = await busTicketCollection.updateOne(query, {
        $set: { bookedSeats: allSeat },
      });

      res.send({ result, updateResult });
    });

    // payment Collection
    app.get("/payment/:id", async (req, res) => {
      const transactionId = req.params.id;
      const query = { transactionId: transactionId };
      const result = await busPaymentCollection.findOne(query);
      res.send(result);
    });

    //bus services added from here

    app.post("/busServices", async (req, res) => {
      const busService = req.body;
      const result = await busServiceCollection.insertOne(busService);
      res.status(200).send({ message: "bus added to database" });
    });

    app.get("/busServices", async (req, res) => {
      const result = await busServiceCollection.find().toArray();
      res.send(result);
    });

    // flash deals api
    app.get("/bus-flash-deal", async (req, res) => {
      const result = await busFlashDealCollection.find().toArray();
      // console.log(result)
      res.send(result);
    });

    // -------------Tavel API End----------------

    // ------------- Stripe Payment----------
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      if (!price) {
        return;
      }

      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"]
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })
    // ------------- Stripe Payment----------

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
