import express from "express";
import upload from "../middlewares/upload.js";
import { createEvent, allEvents, eventsById, deleteEvent } from "../Controller/eventController.js";

const eventRouter = express.Router();

eventRouter.post(
    "/createEvent",
    upload.single("bannerImage"),
    createEvent
);

eventRouter.get("/allEvents", allEvents);
eventRouter.get("/eventDetail/:id", eventsById);
eventRouter.delete("/deleteEvent/:id", deleteEvent);


export default eventRouter;
