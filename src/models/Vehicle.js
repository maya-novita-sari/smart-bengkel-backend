const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    customer   : { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    plateNumber: { type: String, required: true, unique: true },
    brand      : String,
    model      : String,
    year       : Number,
    odometerKm : Number,
    serviceHistory: [
      {
        workOrder: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder" },
        date     : Date,
        note     : String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vehicle", vehicleSchema);