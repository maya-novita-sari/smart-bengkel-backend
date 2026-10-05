const mongoose = require("mongoose");

const sparepartSchema = new mongoose.Schema(
  {
    name        : { type: String, required: true },
    code        : { type: String, required: true, unique: true },
    price       : { type: Number, required: true, min: 0 },
    costPrice   : { type: Number, default: 0, min: 0 },
    stock       : { type: Number, default: 0, min: 0 },
    minStock    : { type: Number, default: 0 },
    rackLocation: String,
    transactions: [
      {
        type     : { type: String, enum: ["IN", "OUT", "RETURN", "OPNAME", "WO_RETURN"] },
        qty      : Number,
        note     : String,
        workOrder: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder" },
        by       : { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        date     : { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sparepart", sparepartSchema);
