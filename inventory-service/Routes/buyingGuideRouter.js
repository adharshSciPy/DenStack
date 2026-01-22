import express from "express";
import { createBuyingGuide, getBuyingGuide, getBuyingGuideStepsById, deleteBuyingGuide } from "../Controller/buyingGuideController.js";
import upload from "../middlewares/upload.js";
const buyingGuideRouter = express.Router();

buyingGuideRouter.post(
    "/createBuyingGuide",
    upload.any(), // dynamic files
    createBuyingGuide
);

buyingGuideRouter.get("/getBuyingGuide", getBuyingGuide);
buyingGuideRouter.get("/getBuyingGuideStepsById/:guideId", getBuyingGuideStepsById);
buyingGuideRouter.delete("/deleteBuyingGuide/:guideId", deleteBuyingGuide);

export default buyingGuideRouter;