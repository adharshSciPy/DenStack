import mongoose, { Schema } from 'mongoose';

const EventRegisterationSchema = new Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
        required: true,
    },
    firstName: {
        type: String,
    },
    lastName: {
        type: String,
    },
    email: {
        type: String,
    },
    phoneNumber: {
        type: String,
    },
    organization: {
        type: String,
    },
    jobTitle: {
        type: String,
    },
    address: {
        type: String,
    },
    city: {
        type: String,
    },
    state: {
        type: String,
    },
    zipCode: {
        type: String,
    },
    attendees: {
        type: Number,
    },
    dietaryRestrictions: {
        type: String,
    },
    specialQuestions: {
        type: String,
    }
})

const EventRegisteration = mongoose.model('EventRegisteration', EventRegisterationSchema);
export default EventRegisteration;