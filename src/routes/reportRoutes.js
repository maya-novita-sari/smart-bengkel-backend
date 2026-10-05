const router = require("express").Router();
const c = require("../controllers/analyticsController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");

router.get("/", protect, authorize("owner", "kepala_bengkel"), c.getReport);

module.exports = router;
