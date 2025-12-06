import { Router } from "express";
import {
  addPharmacyInventory,
  getPharmacyInventory,
  getPharmacyInventoryById,
  updatePharmacyInventory,
  reducePharmacyStock,
  deletePharmacyInventory,
  getLowStockItems
} from "../controller/pharmacyInventoryController.js";
import { auth } from "../middleware/auth.js";
import { checkRole } from "../middleware/checkRole.js";

const router = Router();

// ROLES MUST BE STRING VALUES
const allowedRoles = ["800", "700"];  // 200 = PHARMACIST_ROLE, 700 = Clinic

router.post("/add", addPharmacyInventory); //Add new inventory item
router.get("/all/:pharmacyId", auth,checkRole(allowedRoles), getPharmacyInventory); //Get all items for a pharmacy
router.get("/item/:id", auth,checkRole(allowedRoles), getPharmacyInventoryById);  //Get item by ID
router.patch("/update/:id",auth,checkRole(allowedRoles),updatePharmacyInventory);  //Update item
router.put("/reduce/:id",auth,checkRole(allowedRoles),reducePharmacyStock);        //Reduce stock  by product ID
router.delete("/delete/:id",auth,checkRole(allowedRoles),deletePharmacyInventory);    //Delete item
router.get("/low-stock/:pharmacyId", auth,checkRole(allowedRoles), getLowStockItems);  //Get low stock items

export default router;
