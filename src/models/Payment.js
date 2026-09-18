const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    invoice : { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },
    method  : { type: String, enum: ["CASH", "QRIS", "TRANSFER", "DP"] },
    amount  : { type: Number, required: true },
    isRefund: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);