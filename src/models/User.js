const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name    : { type: String, required: true },
    email   : { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role    : {
      type    : String,
      enum    : ["owner", "kepala_bengkel", "sa", "mekanik", "gudang", "kasir", "konsumen"],
      required: true,
    },
    phone: String,
    specialization: [String],         // khusus mekanik
    capacity      : Number,           // khusus mekanik
    schedule      : [String],         // khusus mekanik
    isActive      : { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);