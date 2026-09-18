const express = require("express");
const router = express.Router();
const { getMechanics, createMechanic, updateMechanic } = require("../controllers/userController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");

router.get("/mechanics", protect, authorize("kepala_bengkel", "sa"), getMechanics);
router.post("/mechanics", protect, authorize("kepala_bengkel"), createMechanic);
router.put("/mechanics/:id", protect, authorize("kepala_bengkel"), updateMechanic);

module.exports = router;