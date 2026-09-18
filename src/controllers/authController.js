const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const generateToken = (id) =>
  jwt.sign({ id }, 
  process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email, password: hashed, phone, role: "konsumen",
    });
    res.status(201).json({ token: generateToken(user._id)});
  } 
  
  catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Email atau password salah" });
    }
    res.json({ token: generateToken(user._id), role: user.role });
  } 
  
  catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json(req.user);
};