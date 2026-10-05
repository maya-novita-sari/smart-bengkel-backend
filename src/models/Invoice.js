const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true },
    workOrder  : { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder", required: true },
    customer   : { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    items: [
      {
        kind : { type: String, enum: ["JASA", "PART"] },
        name : String,
        qty  : Number,
        price: Number,
        total: Number,
      },
    ],
    serviceCost: { type: Number, default: 0 },
    partsCost  : { type: Number, default: 0 },
    discount   : { type: Number, default: 0 },
    totalCost  : { type: Number, required: true },
    paidAmount : { type: Number, default: 0 },
    pointsAwarded: { type: Number, default: 0 },
    status     : { type: String, enum: ["UNPAID", "PARTIAL", "PAID", "VOID"], default: "UNPAID" },
    createdBy  : { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
