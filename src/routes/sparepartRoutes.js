const router = require("express").Router();
const c = require("../controllers/sparepartController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");

router.use(protect);
router.get("/", authorize("gudang", "mekanik", "sa"), c.getSpareparts);
router.post("/", authorize("gudang"), c.createSparepart);
router.post("/transactions", authorize("gudang"), c.createTransaction); // sebelum "/:id"
router.put("/:id", authorize("gudang"), c.updateSparepart);

module.exports = router;
