import { Router } from "express";
import { createProduct, productDetails, getProduct, updateProduct, deleteProduct } from "../Controller/productController.js";
import upload from "../middlewares/upload.js";

const productRoute = Router();

productRoute.post("/createProduct", upload.single("image"), createProduct);
productRoute.route("/productsDetails").get(productDetails);
productRoute.route("/getProduct/:id").get(getProduct);
productRoute.put("/updateProduct/:id", upload.single("image"), updateProduct);
productRoute.route("/deleteProduct/:id").delete(deleteProduct)

export default productRoute;