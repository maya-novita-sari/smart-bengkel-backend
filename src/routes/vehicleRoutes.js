const router = require("express").Router();
const c = require("../controllers/customerController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");

router.use(protect);
router.post("/", authorize("sa", "konsumen"), c.createVehicle);
router.get("/:id/history", authorize("sa", "mekanik", "konsumen"), c.getVehicleHistory);

module.exports = router;
