const mongoose = require("mongoose");

const workOrderSchema = new mongoose.Schema(
  {
    woNumber      : { type: String, unique: true },
    booking       : { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    customer      : { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    vehicle       : { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    serviceAdvisor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    mechanic      : { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    complaint     : String,
    odometerKm    : Number,
    services      : [{ name: String, price: { type: Number, default: 0 } }], // jasa
    estimate      : { type: Number, default: 0 },
    dvi           : [{ item: String, condition: String, note: String }],
    diagnosis     : { type: String },
    recommendation: { type: String },
    media         : [{ url: String, type: String, originalName: String, uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" } }],
    spareparts    : [
      {
        sparepart: { type: mongoose.Schema.Types.ObjectId, ref: "Sparepart" },
        qty      : { type: Number, required: true, min: 1 },
        price    : Number,     // snapshot harga jual
        costPrice: Number,     // snapshot harga modal
        status   : { type: String, enum: ["REQUESTED", "ISSUED", "RETURNED"], default: "REQUESTED" },
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    qc: {
      checklist : [{ item: String, passed: Boolean }],
      notes     : String,
      testNotes : String,
      checkedBy : { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      approved  : { type: Boolean, default: false },
      approvedAt: Date,
    },
    status: {
      type   : String,
      enum   : ["DRAFT", "DIKERJAKAN", "QC", "SELESAI"],
      default: "DRAFT",
    },
    statusHistory: [
      {
        status: String,
        by    : { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at    : { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

workOrderSchema.index({ status: 1, mechanic: 1 });

module.exports = mongoose.model("WorkOrder", workOrderSchema);
