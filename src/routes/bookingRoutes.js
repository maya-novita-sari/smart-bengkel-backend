const router = require("express").Router();
const c = require("../controllers/bookingController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");

router.use(protect);
// route statis harus di atas "/:id/..."
router.get("/schedule", authorize("konsumen", "sa"), c.getSchedule);
router.get("/smart-mechanic", authorize("konsumen", "sa"), c.smartMechanic);
router.post("/", authorize("konsumen", "sa"), c.createBooking);
router.patch("/:id/status", authorize("sa", "kepala_bengkel"), c.updateBookingStatus);

module.exports = router;
