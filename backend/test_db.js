require("dotenv").config();
const mongoose = require("mongoose");
const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

console.log("Connecting to:", process.env.MONGO_URI);
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Successfully connected to MongoDB");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Connection error:", err);
    process.exit(1);
  });
