const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    invoice : { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },
    method  : { type: String, enum: ["CASH", "QRIS", "TRANSFER"], required: true },
    type    : { type: String, enum: ["DP", "PELUNASAN"], default: "PELUNASAN" },
    amount  : { type: Number, required: true, min: 1 },
    status  : { type: String, enum: ["SUCCESS", "VOID"], default: "SUCCESS" },
    isRefund: { type: Boolean, default: false },
    refundOf: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    reason  : String,
    reference: String, // no. referensi QRIS / transfer
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
