import express from "express";
import { setShippingCharge, getShippingCharge } from "../Controller/shippingController.js";
import { verifyAuthToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/set", verifyAuthToken, setShippingCharge);
router.get("/get", getShippingCharge);

export default router;