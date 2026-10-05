const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    customer           : { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    vehicle            : { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    scheduledAt        : { type: Date, required: true },
    serviceType        : String,
    recommendedMechanic: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type   : String,
      enum   : ["PENDING", "CONFIRMED", "CANCELLED", "CHECKED_IN"],
      default: "PENDING",
    },
    cancelReason: String,
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

bookingSchema.index({ scheduledAt: 1, status: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
