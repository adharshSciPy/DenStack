import { Router } from "express";
import { createProduct, productDetails, getProduct, productsByCategory, getProductsByBrand, updateProduct, deleteProduct, getProductsByIds } from "../Controller/productController.js";
import { verifyAuthToken, authorizeRoles } from "../middlewares/authmiddleware.js";
import upload from "../middlewares/upload.js";

const SUPER_ADMIN = process.env.SUPERADMIN_ROLE
const CLINIC_ROLE = process.env.CLINIC_ROLE
const VENDOR_ROLE = "VENDOR";

const productRoute = Router();

productRoute.post("/createProduct", verifyAuthToken, authorizeRoles(VENDOR_ROLE, SUPER_ADMIN), upload.array("image", 3), createProduct);

productRoute.get("/productsDetails", verifyAuthToken, authorizeRoles(SUPER_ADMIN, CLINIC_ROLE), productDetails);
productRoute.get("/getProduct/:id", getProduct);
productRoute.get("/getProductByBrand/:id", verifyAuthToken, authorizeRoles(SUPER_ADMIN, CLINIC_ROLE), getProductsByBrand)
productRoute.post("/get-by-ids", getProductsByIds)
productRoute.put(
  "/updateProduct/:id",
  verifyAuthToken,
  authorizeRoles(SUPER_ADMIN),
  upload.fields([
    { name: "image", maxCount: 1 },  // single image
    { name: "images", maxCount: 5 }, // multiple images
  ]),
  updateProduct
);
productRoute.delete("/deleteProduct/:id", verifyAuthToken, authorizeRoles(SUPER_ADMIN), deleteProduct);
productRoute.get("/productsByCategory/:id", verifyAuthToken, authorizeRoles(SUPER_ADMIN, CLINIC_ROLE), productsByCategory);

export default productRoute;