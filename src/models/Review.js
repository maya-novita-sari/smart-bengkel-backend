const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    customer    : { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    workOrder   : { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder" },
    mechanic    : { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rating      : { type: Number, min: 1, max: 5, required: true },
    mechanicRating: { type: Number, min: 1, max: 5 },
    comment     : String,
  },
  { timestamps: true }
);

// 1 ulasan per WO
reviewSchema.index({ workOrder: 1 }, { unique: true, partialFilterExpression: { workOrder: { $type: "objectId" } } });

module.exports = mongoose.model("Review", reviewSchema);
