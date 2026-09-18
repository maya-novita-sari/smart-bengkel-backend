const mongoose = require("mongoose");

const sparepartSchema = new mongoose.Schema(
  {
    name        : { type: String, required: true },
    code        : { type: String, required: true, unique: true },
    price       : { type: Number, required: true },
    stock       : { type: Number, default: 0 },
    minStock    : { type: Number, default: 0 },
    rackLocation: String,
    transactions: [
      {
        type     : { type: String, enum: ["IN", "OUT", "RETURN", "OPNAME"] },
        qty      : Number,
        workOrder: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder" },
        date     : { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sparepart", sparepartSchema);