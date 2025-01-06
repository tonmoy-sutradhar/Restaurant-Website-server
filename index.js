require("dotenv").config();
var jwt = require("jsonwebtoken");
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// 68-4 no vedio ---> just start.

// -----------------------------------------MongoDB Connection--------------------------------------------------

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.cjt8m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const menuCollection = client.db("Restaurant").collection("menu");
    const reviewsCollection = client.db("Restaurant").collection("reviews");
    const cartCollection = client.db("Restaurant").collection("carts");
    const userCollection = client.db("Restaurant").collection("users");

    // jWT related API -----------------------------
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "12h",
      });
      // console.log(user);

      res.send({ token });
      console.log("Generated Token Payload:", jwt.decode(token));
    });

    // help chatGPT
    // app.post("/jwt", async (req, res) => {
    //   const user = req.body;

    //   // Validate user contains an email
    //   if (!user || !user.email) {
    //     return res
    //       .status(400)
    //       .send({ message: "Email is required to generate token" });
    //   }

    //   // Create the token
    //   const token = jwt.sign(
    //     { email: user.email }, // Include email in the payload
    //     process.env.ACCESS_TOKEN_SECRET,
    //     { expiresIn: "12h" }
    //   );

    //   res.send({ token });
    // });

    // Verify middleWare ------>>
    // const verifyToken = (req, res, next) => {
    //   console.log("Inside verify token", req.headers.authorization);
    //   next();
    //   // authorization na thakle
    //   if (!req.headers.authorization) {
    //     return res.this.status(401).send({ message: "forbidden access" });
    //   }

    //   const token = req.headers.authorization.split(" ")[1];
    //   console.log("Authorization Header:", req.headers.authorization);

    //   // verify jwt token--->
    //   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    //     if (err) {
    //       return res.status(401).send({ message: "forbidden access" });
    //     }
    //     req.decoded = decoded;
    //     console.log("Decoded Token:", decoded);

    //     console.log("Decoded email:", req.decoded.email);

    //     next();
    //   });
    // };

    // help CHATGPT
    const verifyToken = (req, res, next) => {
      const authorization = req.headers.authorization;

      // Check if Authorization header exists
      if (!authorization) {
        return res
          .status(401)
          .send({ message: "Unauthorized: No token provided" });
      }

      const token = authorization.split(" ")[1]; // Extract token from "Bearer <token>"

      // Verify the token
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          console.error("JWT Verification Error:", err.message);
          return res.status(403).send({ message: "Forbidden: Invalid token" });
        }

        // Ensure decoded contains email
        if (!decoded || !decoded.email) {
          console.error("Decoded token missing email:", decoded);
          return res
            .status(403)
            .send({ message: "Forbidden: Email not found in token" });
        }

        req.decoded = decoded; // Set the decoded token payload
        next(); // Proceed to the next middleware or route handler
      });
    };

    // user verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // User API
    // user get from database
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // check user is Admin or not
    // app.get("/users/admin/:email", verifyToken, async (req, res) => {
    //   const email = req.params.email;
    //   if (email !== req.decoded.email) {
    //     return res.status(403).send({ message: "unauthorized access" });
    //   }
    //   const query = { email: email };
    //   const user = await userCollection.findOne(query);
    //   let admin = false;
    //   if (user) {
    //     admin = user?.role === "admin";
    //   }

    //   res.send({ admin });
    // });

    // help chatgpt check user is Admin or not
    app.get(
      "/users/admin/:email",
      verifyToken,

      async (req, res) => {
        const email = req.params.email;

        // Ensure req.decoded exists before accessing it
        if (!req.decoded || !req.decoded.email) {
          return res
            .status(403)
            .send({ message: "Forbidden: Decoded email not found" });
        }

        if (email !== req.decoded.email) {
          return res.status(403).send({ message: "Unauthorized access" });
        }

        const query = { email: email };
        const user = await userCollection.findOne(query);
        const admin = user?.role === "admin";

        res.send({ admin });
      }
    );

    // insert email
    app.post("/users", async (req, res) => {
      const user = req.body;

      // inset email if user doesn't exist:
      // i can do many ways (1. email unique, 2. upsert 3. simple check)

      const query = { email: user?.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Set role -->> Admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Delete user from database
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // Restaurant related API

    // Restaurant item add
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    // cart data post
    app.post("/carts", async (req, res) => {
      const cart = req.body;
      const result = await cartCollection.insertOne(cart);
      res.send(result);
    });

    // cart data get
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    // cart delete by id
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);

      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

// -----------------------------------------MongoDB Connection--------------------------------------------------

app.get("/", (req, res) => {
  res.send("Restaurant-Website-server is running");
});
app.listen(port, () => {
  console.log("Port is running on port", port);
});
