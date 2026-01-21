import express from "express";
import { createBuyingGuide } from "../Controller/buyingGuideController.js";
import upload from "../middlewares/upload.js";
const buyingGuideRouter = express.Router();

buyingGuideRouter.post("/createBuyingGuide", upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "sectionImages", maxCount: 20 },
    { name: "productImages", maxCount: 20 }
]), createBuyingGuide);

export default buyingGuideRouter;