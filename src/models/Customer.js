const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name   : { type: String, required: true },
    phone  : { type: String, required: true },
    email  : String,
    address: String,
    user   : { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // link ke akun konsumen (opsional)
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);