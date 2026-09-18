const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    customer           : { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    vehicle            : { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    scheduledAt        : { type: Date, required: true },
    recommendedMechanic: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type   : String,
      enum   : ["PENDING", "CONFIRMED", "CANCELLED"],
      default: "PENDING",
    },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);