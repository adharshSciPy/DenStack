import Router from "express";
import { getVendorNotifications, markNotificationRead } from "../Controller/notificationController.js";

const notificationRouter = Router();

notificationRouter.get("/:vendorId", getVendorNotifications);
notificationRouter.put("/read/:id", markNotificationRead);

export default notificationRouter;