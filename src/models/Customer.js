const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name   : { type: String, required: true },
    phone  : { type: String, required: true },
    email  : String,
    address: String,
    user   : { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // link ke akun konsumen (opsional)
    loyaltyPoints: { type: Number, default: 0 },
    vouchers: [
      {
        code     : String,
        discount : Number, // nominal Rp
        expiresAt: Date,
        used     : { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

customerSchema.index({ name: "text", phone: "text", email: "text" });

module.exports = mongoose.model("Customer", customerSchema);
