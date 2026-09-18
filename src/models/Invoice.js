const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    workOrder  : { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder", required: true },
    serviceCost: { type: Number, default: 0 },
    partsCost  : { type: Number, default: 0 },
    totalCost  : { type: Number, required: true },
    status     : { type: String, enum: ["UNPAID", "PAID", "VOID"], default: "UNPAID" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);