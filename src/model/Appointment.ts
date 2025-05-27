// models/Appointment.js
import mongoose, { Schema, Document } from "mongoose";

export interface Appointment extends Document {
  appointmentTitle: string; // Title of the appointment
  description?: string; // Optional description of the appointment
  startTimeUTC: Date; // Start time in UTC
  endTimeUTC: Date; // End time in UTC
  duration: number; // Duration in minutes
  status: "scheduled" | "completed" | "cancelled"; // Status of the appointment
  googleMeetLink: string; // Optional Zoom link for the appointment
  remindersSent: {
    confirmation: boolean;
    oneHourBefore: boolean;
  };
  clientEmail: string;
 clientTimezone: string;
}

const AppointmentSchema: Schema<Appointment> = new mongoose.Schema(
  {

    startTimeUTC: { type: Date, required: true }, // Stored in UTC
    endTimeUTC: { type: Date, required: true }, // Stored in UTC
    // duration: { type: Number, required: true }, // minutes
    appointmentTitle: { type: String },
    description: { type: String, default: "" }, // Optional description
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    }, 
clientEmail: {
  type: String,
  required: [true, "Please provide an email"],
  match: [
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    "Please provide a valid email address"
  ],
},
clientTimezone: {
  type: String,
  required: [true, "Please provide your time zone (e.g., 'Asia/Kathmandu')"]
},
    googleMeetLink: { type: String },
    remindersSent: {
      confirmation: Boolean,
      oneHourBefore: Boolean,
    },
  },
  { timestamps: true }
);

const AppointmentModel =
  (mongoose.models.Appointment as mongoose.Model<Appointment>) ||
  mongoose.model<Appointment>("Appointment", AppointmentSchema);

export default AppointmentModel;
