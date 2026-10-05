const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Customer = require("../models/Customer");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || "7d" });

exports.register = async (req, res) => {
  const { name, email, password, phone, address } = req.body;
  if (!name || !email || !password || !phone) {
    return res.status(400).json({ message: "name, email, password, dan phone wajib diisi" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: "Password minimal 6 karakter" });
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed, phone, role: "konsumen" });
  // Otomatis buat profil pelanggan agar konsumen bisa booking & mendaftarkan kendaraan
  try {
    await Customer.create({ name, phone, email, address, user: user._id });
  } catch (err) {
    await User.findByIdAndDelete(user._id); // rollback
    throw err;
  }
  res.status(201).json({ token: generateToken(user._id), role: user.role });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "email dan password wajib diisi" });
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Email atau password salah" });
  }
  if (!user.isActive) return res.status(403).json({ message: "Akun dinonaktifkan" });
  res.json({ token: generateToken(user._id), role: user.role });
};

exports.getMe = async (req, res) => {
  const data = req.user.toObject();
  if (req.user.role === "konsumen") {
    data.customer = await Customer.findOne({ user: req.user._id });
  }
  res.json(data);
};
