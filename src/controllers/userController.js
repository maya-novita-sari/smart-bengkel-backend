const User = require("../models/User");
const bcrypt = require("bcryptjs");

// GET /api/v1/users/mechanics
exports.getMechanics = async (req, res) => {
  try {
    const mechanics = await User.find({ role: "mekanik" });
    res.json(mechanics);
  } 
  
  catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/v1/users/mechanics
exports.createMechanic = async (req, res) => {
  try {
    const { name, email, password, phone, specialization, capacity, schedule } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const mechanic = await User.create({
      name,
      email,
      password: hashed,
      phone,
      role: "mekanik",
      specialization,
      capacity,
      schedule,
    });
    res.status(201).json(mechanic);
  } 
  
  catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT /api/v1/users/mechanics/:id
exports.updateMechanic = async (req, res) => {
  try {
    const { specialization, capacity, schedule } = req.body;
    const mechanic = await User.findByIdAndUpdate(
      req.params.id,
      { specialization, capacity, schedule },
      { new: true }
    );
    if (!mechanic) return res.status(404).json({ message: "Mekanik tidak ditemukan" });
    res.json(mechanic);
  } 
  
  catch (err) {
    res.status(400).json({ message: err.message });
  }
};