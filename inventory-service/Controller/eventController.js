import Event from "../Model/EventSchema.js";

const createEvent = async (req, res) => {
    try {
        const {
            eventType,
            category,
            title,
            description,
            date,
            startTime,
            endTime,
            venue,
            address,
            city,
            state,
            country,
            pincode,
            totalSeats,
            registrationDeadline,
            isFeatured,
            highlights,
            schedule,
            speakers,
            organizer,
        } = req.body;

        // Banner image
        const bannerImage = req.file
            ? `/uploads/${req.file.filename}`
            : null;

        // Parse JSON fields (multipart/form-data)
        const parsedHighlights = highlights ? JSON.parse(highlights) : [];
        const parsedSchedule = schedule ? JSON.parse(schedule) : [];
        const parsedSpeakers = speakers ? JSON.parse(speakers) : [];
        const parsedOrganizer = organizer ? JSON.parse(organizer) : null;

        const event = await Event.create({
            eventType,
            category,
            title,
            description,
            date,
            startTime,
            endTime,
            venue,
            address,
            city,
            state,
            country,
            pincode,
            bannerImage,
            highlights: parsedHighlights,
            schedule: parsedSchedule,
            speakers: parsedSpeakers,
            organizer: parsedOrganizer,
            totalSeats,
            registrationDeadline,
            isFeatured,
        });

        res.status(201).json({
            success: true,
            message: "Event created successfully",
            data: event,
        });
    } catch (error) {
        console.error("Create Event Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create event",
            error: error.message,
        });
    }
};

const allEvents = async (req, res) => {
    try {
        const events = await Event.find();
        res.status(200).json({
            success: true,
            data: events
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch events",
            error: error.message
        });
    }
}

const eventsById = async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }
        res.status(200).json({
            success: true,
            data: event
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch event",
            error: error.message
        });
    }
}

const deleteEvent = async (req, res) => {
    try {
        const eventId = req.params.id;
        const deletedEvent = await Event.findByIdAndDelete(eventId);
        if (!deletedEvent) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }
        res.status(200).json({
            success: true,
            message: "Event deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete event",
            error: error.message
        });
    }
}


export { createEvent, allEvents, eventsById, deleteEvent };