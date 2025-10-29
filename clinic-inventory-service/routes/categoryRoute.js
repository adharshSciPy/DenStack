import { Router } from "express";

import { createCategory, getCategories } from "../controller/categoryController.js";
import { addItem, getItemsByCategory ,getItemsByIds,getLowStockItems,getInventorySummary,getFilteredInventoryItems} from "../controller/inventoryItemController.js";
import { createPurchase } from "../controller/purchaseController.js";
import { transferToLabService } from "../controller/stockController.js";
const categoryRoute = Router();

categoryRoute.post("/create-category", createCategory);
categoryRoute.get("/categories/:clinicId", getCategories);
categoryRoute.post("/add-item", addItem);
categoryRoute.post("/create-purchase", createPurchase);
categoryRoute.get("/get-categories/:clinicId/:categoryId", getItemsByCategory);
categoryRoute.get("/get-itembyid/:clinicId/:itemIds", getItemsByIds);
categoryRoute.get("/low-stock-items/:clinicId", getLowStockItems);
categoryRoute.get("/inventory-summary/:clinicId", getInventorySummary);
categoryRoute.get("/filtered-inventory-items/:clinicId", getFilteredInventoryItems);
categoryRoute.post("/stock-transfer-to-lab", transferToLabService); ;
export default categoryRoute