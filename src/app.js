const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/api/v1/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/v1/auth", require("./routes/authRoutes"));
app.use("/api/v1/users", require("./routes/userRoutes"));
app.use("/api/v1/customers", require("./routes/customerRoutes"));
app.use("/api/v1/vehicles", require("./routes/vehicleRoutes"));
app.use("/api/v1/bookings", require("./routes/bookingRoutes"));
app.use("/api/v1/work-orders", require("./routes/workOrderRoutes"));
app.use("/api/v1/spareparts", require("./routes/sparepartRoutes"));
app.use("/api/v1/invoices", require("./routes/invoiceRoutes"));
app.use("/api/v1/payments", require("./routes/paymentRoutes"));
app.use("/api/v1/crm", require("./routes/crmRoutes"));
app.use("/api/v1/reviews", require("./routes/reviewRoutes"));
app.use("/api/v1/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/v1/reports", require("./routes/reportRoutes"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
