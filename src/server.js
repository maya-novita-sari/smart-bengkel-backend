require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
  } catch (err) {
    console.error("Gagal start server:", err.message);
    process.exit(1);
  }
};

startServer();