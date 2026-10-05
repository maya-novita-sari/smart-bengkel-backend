const router = require("express").Router();
const c = require("../controllers/customerController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");

router.use(protect);
router.get("/", authorize("sa", "owner", "kepala_bengkel"), c.getCustomers);
router.post("/", authorize("sa"), c.createCustomer);
router.get("/:id/vehicles", authorize("sa", "konsumen"), c.getCustomerVehicles);

module.exports = router;
