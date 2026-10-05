const router = require("express").Router();
const c = require("../controllers/analyticsController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");

router.use(protect);
router.get("/owner", authorize("owner"), c.ownerDashboard);
router.get("/operational", authorize("kepala_bengkel"), c.operationalDashboard);

module.exports = router;
