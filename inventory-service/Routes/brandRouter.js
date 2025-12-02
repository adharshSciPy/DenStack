import express from "express";
import {
    createBrand,
    getBrandsByCategory,
    getAllBrands, deleteBrand
} from "../Controller/brandController.js";
import upload from "../middlewares/upload.js"

const brandRouter = express.Router();

brandRouter.post("/createBrand", upload.single("image"), createBrand);
brandRouter.get("/getAllBrands", getAllBrands);
brandRouter.get("/brandByCategory/:id", getBrandsByCategory);
brandRouter.delete("/deleteBrand/:id", deleteBrand)

export default brandRouter;
