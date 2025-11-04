import express from "express";
import {
    createBrand,
    getBrandsByCategory,
    getAllBrands,
} from "../Controller/brandController.js";

const brandRouter = express.Router();

brandRouter.post("/createBrand", createBrand);
brandRouter.get("/getAllBrands", getAllBrands);
brandRouter.get("/brandByCategory/:id", getBrandsByCategory);

export default brandRouter;
