import mongoose, { Schema } from "mongoose";

const SpeakerSchema = new Schema({
  name: { type: String, required: true },
  designation: { type: String }, // Lead Implantologist, Oral Surgeon
  organization: { type: String }, // NYU College of Dentistry
  bio: { type: String },
  avatar: { type: String }, // image URL or initials
});

const ScheduleSchema = new Schema({
  title: { type: String },
  startTime: { type: String }, // "09:00 AM"
  endTime: { type: String },   // "10:30 AM"
  description: { type: String },
});

const OrganizerSchema = new Schema({
  name: { type: String },
  phone: { type: String },
  email: { type: String },
  website: { type: String },
});

const EventSchema = new Schema(
  {
    // Basic Info
    eventType: {
      type: String,
      enum: ["Workshop", "Conference", "Webinar", "Seminar"],
      required: true,
    },
    category: { type: String }, // Workshops, Featured
    title: { type: String, required: true },
    description: { type: String },

    // Date & Time
    date: { type: Date, required: true },
    startTime: { type: String }, // "09:00 AM"
    endTime: { type: String },   // "05:00 PM"

    // Location
    venue: { type: String }, // Grand Medical Center
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    pincode: { type: String },

    // Media
    bannerImage: { type: String },
    // galleryImages: [{ type: String }],

    // Highlights
    highlights: [{ type: String }],

    // Schedule
    schedule: [ScheduleSchema],

    // Speakers
    speakers: [SpeakerSchema],

    // Organizer
    organizer: OrganizerSchema,

    // Registration
    totalSeats: { type: Number, default: 100 },
    registeredCount: { type: Number, default: 0 },
    registrationDeadline: { type: Date },
    isFeatured: { type: Boolean, default: false },

    // Status
    status: {
      type: String,
      enum: ["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"],
      default: "UPCOMING",
    },
  },
  { timestamps: true }
);

const Event = mongoose.model("Event", EventSchema);

export default Event;
