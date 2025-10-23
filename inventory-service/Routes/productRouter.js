import { Router } from "express";
import { createProduct, productDetails, getProduct, productsByCategory, updateProduct, deleteProduct } from "../Controller/productController.js";
import { verifyAuthToken, authorizeRoles } from "../middlewares/authmiddleware.js";
import upload from "../middlewares/upload.js";

const SUPER_ADMIN = process.env.SUPERADMIN_ROLE
const CLINIC_ROLE = process.env.CLINIC_ROLE

const productRoute = Router();

productRoute.post("/createProduct", verifyAuthToken, authorizeRoles(SUPER_ADMIN), upload.single("image"), createProduct);
productRoute.get("/productsDetails", verifyAuthToken, authorizeRoles(SUPER_ADMIN, CLINIC_ROLE), productDetails);
productRoute.get("/getProduct/:id", verifyAuthToken, authorizeRoles(SUPER_ADMIN), getProduct);
productRoute.put("/updateProduct/:id", verifyAuthToken, authorizeRoles(SUPER_ADMIN), upload.single("image"), updateProduct);
productRoute.delete("/deleteProduct/:id", verifyAuthToken, authorizeRoles(SUPER_ADMIN), deleteProduct);
productRoute.get("/productsByCategory/:id", verifyAuthToken, authorizeRoles(SUPER_ADMIN, CLINIC_ROLE), productsByCategory);

export default productRoute;