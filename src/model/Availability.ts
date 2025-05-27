import mongoose, { Schema, Document } from "mongoose";

export interface Availability extends Document {

  // days: string[]; // e.g., ['mon', 'tue', 'wed', 'thu', 'fri']
  slotDuration?: number; // in minutes, default 30
  bufferBetweenSlots?: number; // in minutes, default 10
  startTime: string;
  endTime: string;
  admintimezone: string;
  createdAt?: Date;
}

const AvailabilitySchema: Schema<Availability> = new Schema({

  startTime: { type: String, required: true }, // "09:00" in admin's timezone
  endTime: { type: String, required: true }, // "16:00" in admin's timezone
  slotDuration: { type: Number, default: 20 }, // minutes
  admintimezone: {
    type: String,
    required: [true, "Please provide an timezone"],
  },
  bufferBetweenSlots: { type: Number, default: 10 }, // minutes
});

const AvailabilityModel =
  (mongoose.models.Availability as mongoose.Model<Availability>) ||
  mongoose.model<Availability>("Availability", AvailabilitySchema);

export default AvailabilityModel;
//  days: {
//   type: [String],
//   enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
//   default: ['mon', 'tue', 'wed', 'thu', 'fri']
// },
