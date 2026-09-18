const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    customer    : { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    workOrder   : { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder" },
    mechanic    : { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rating      : { type: Number, min: 1, max: 5, required: true },
    comment     : String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Review", reviewSchema);