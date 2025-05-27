import dbConnect from "@/lib/dbConnect";
import AvailabilityModel from "@/model/Availability";
import { NextResponse } from "next/server";
import { DateTime } from "luxon";

// GET current availability settings
export async function GET() {
  try {
    await dbConnect();

    const availability = await AvailabilityModel.findOne();

    if (!availability) {
      return NextResponse.json(
        { error: "Availability not configured yet" },
        { status: 404 }
      );
    }

    return NextResponse.json(availability);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create or update availability settings
export async function POST(request: Request) {
  try {
    await dbConnect();

    const body = await request.json();
    const {
      startTime,
      endTime,
      slotDuration,
      admintimezone,
      bufferBetweenSlots,
    } = body;

    // Validate required fields
    if (!startTime || !endTime || !admintimezone) {
      return NextResponse.json(
        { error: "startTime, endTime, and admintimezone are required" },
        { status: 400 }
      );
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { error: "Time must be in HH:mm format" },
        { status: 400 }
      );
    }

    // Check if end time is after start time
    const start = DateTime.fromFormat(startTime, "HH:mm");
    const end = DateTime.fromFormat(endTime, "HH:mm");
    if (end <= start) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    // Check if timezone is valid
    if (!DateTime.local().setZone(admintimezone).isValid) {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }

    // Since we're not using adminId, we'll just maintain one availability configuration
    // This will either create new or update existing
    const availability = await AvailabilityModel.findOneAndUpdate(
      {}, // Empty filter matches first document
      {
        startTime,
        endTime,
        slotDuration: slotDuration || 20,
        admintimezone,
        bufferBetweenSlots: bufferBetweenSlots || 10,
      },
      {
        new: true,
        upsert: true, // Create if doesn't exist
      }
    );

    return NextResponse.json(availability);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH update availability settings
export async function PATCH(request: Request) {
  try {
    await dbConnect();

    const body = await request.json();
    const updates: { [key: string]: any } = {};

    // Only allow certain fields to be updated
    const allowedFields = [
      "startTime",
      "endTime",
      "slotDuration",
      "admintimezone",
      "bufferBetweenSlots",
    ];

    // Validate and prepare updates
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Special validation for time fields
        if ((field === "startTime" || field === "endTime") && body[field]) {
          const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
          if (!timeRegex.test(body[field])) {
            return NextResponse.json(
              { error: `${field} must be in HH:mm format` },
              { status: 400 }
            );
          }
        }

        // Special validation for timezone
        if (field === "admintimezone" && body[field]) {
          if (!DateTime.local().setZone(body[field]).isValid) {
            return NextResponse.json(
              { error: "Invalid timezone" },
              { status: 400 }
            );
          }
        }

        updates[field] = body[field];
      }
    }

    // If updating both start and end times, validate they make sense together
    if (updates.startTime && updates.endTime) {
      const start = DateTime.fromFormat(updates.startTime, "HH:mm");
      const end = DateTime.fromFormat(updates.endTime, "HH:mm");
      if (end <= start) {
        return NextResponse.json(
          { error: "End time must be after start time" },
          { status: 400 }
        );
      }
    }

    // Update the availability settings
    const availability = await AvailabilityModel.findOneAndUpdate(
      {}, // Empty filter matches first document
      updates,
      { new: true }
    );

    if (!availability) {
      return NextResponse.json(
        { error: "Availability not configured yet" },
        { status: 404 }
      );
    }

    return NextResponse.json(availability);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
