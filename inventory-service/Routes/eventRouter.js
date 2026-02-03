import express from "express";
import upload from "../middlewares/upload.js";
import { createEvent, allEvents, eventsById, deleteEvent, eventRegisteration, getEventRegistrations } from "../Controller/eventController.js";

const eventRouter = express.Router();

eventRouter.post(
    "/createEvent",
    upload.single("bannerImage"),
    createEvent
);

eventRouter.get("/allEvents", allEvents);
eventRouter.get("/eventDetail/:id", eventsById);
eventRouter.delete("/deleteEvent/:id", deleteEvent);

eventRouter.post("/eventRegistration", eventRegisteration);
eventRouter.get("/getEventRegistrations", getEventRegistrations);


export default eventRouter;
