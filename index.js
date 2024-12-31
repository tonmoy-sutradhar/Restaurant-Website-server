const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Restaurant-Website-server is running");
});
app.listen(port, () => {
  console.log("Port is running on port", port);
});
