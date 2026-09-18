require("dotenv").config();

const dns = require("dns");
      dns.setServers(["8.8.8.8", "8.8.4.4"]); 
const app = require("./app");
const connectDB = require("./config/db");

connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));