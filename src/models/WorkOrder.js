const mongoose = require("mongoose");

const workOrderSchema = new mongoose.Schema(
  {
    booking       : { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    customer      : { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    vehicle       : { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    serviceAdvisor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    mechanic      : { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    dvi           : [{ item: String, condition: String, note: String }],
    diagnosis     : { type: String },
    recommendation: { type: String },
    media         : [{ url: String, type: String }], // foto/video
    spareparts    : [
      {
        sparepart: { type: mongoose.Schema.Types.ObjectId, ref: "Sparepart" },
        qty      : Number,
      },
    ],
    qc: {
      checklist : [{ item: String, passed: Boolean }],
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      approved  : { type: Boolean, default: false },
    },
    status: {
      type   : String,
      enum   : ["DRAFT", "DIKERJAKAN", "QC", "SELESAI"],
      default: "DRAFT",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkOrder", workOrderSchema);