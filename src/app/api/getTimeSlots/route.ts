import dbConnect from "@/lib/dbConnect";
import AvailabilityModel from "@/model/Availability";
import AppointmentModel from "@/model/Appointment";
import { NextResponse } from "next/server";
import { DateTime, Duration, Interval } from "luxon";

// Helper function to convert admin local time to UTC
function convertLocalToUTC(
  timeStr: string,
  timezone: string,
  date: DateTime
): DateTime {
  return DateTime.fromFormat(timeStr, "HH:mm", { zone: timezone })
    .set({
      year: date.year,
      month: date.month,
      day: date.day,
    })
    .toUTC();
}

// Helper function to generate time slots
function generateTimeSlots(
  availability: any,
  date: DateTime,
  existingAppointments: any[]
): string[] {
  const slots: string[] = [];
  const timezone = availability.admintimezone;

  // Convert admin's working hours to UTC for the requested date
  const workStartUTC = convertLocalToUTC(
    availability.startTime,
    timezone,
    date
  );
  const workEndUTC = convertLocalToUTC(availability.endTime, timezone, date);

  // Create the working hours interval
  const workInterval = Interval.fromDateTimes(workStartUTC, workEndUTC);

  // Calculate durations
  const slotDuration = Duration.fromObject({
    minutes: availability.slotDuration,
  });
  const bufferDuration = Duration.fromObject({
    minutes: availability.bufferBetweenSlots,
  });

  // Generate slots
  let currentSlotStart = workStartUTC;

  while (currentSlotStart.plus(slotDuration) <= workEndUTC) {
    const currentSlotEnd = currentSlotStart.plus(slotDuration);

    // Check for conflicts with existing appointments
    const slotInterval = Interval.fromDateTimes(
      currentSlotStart,
      currentSlotEnd
    );
    const hasConflict = existingAppointments.some((appt) => {
      const apptInterval = Interval.fromDateTimes(
        DateTime.fromJSDate(appt.startTimeUTC),
        DateTime.fromJSDate(appt.endTimeUTC)
      );
      return slotInterval.overlaps(apptInterval);
    });

    if (!hasConflict) {
      // Return UTC time slot (HH:mm format)
      slots.push(currentSlotStart.toFormat("HH:mm"));
    }

    // Move to next potential slot start (current slot end + buffer)
    currentSlotStart = currentSlotEnd.plus(bufferDuration);
  }

  return slots;
}

// GET available time slots for a specific date
export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const date = DateTime.fromISO(dateStr).startOf("day");
    if (!date.isValid) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Get availability (assuming there's only one availability configuration)
    const availability = await AvailabilityModel.findOne();

    if (!availability) {
      return NextResponse.json(
        { error: "Availability not found" },
        { status: 404 }
      );
    }

    // Get existing appointments for this date (in UTC)
    const startOfDayUTC = date.toUTC().startOf("day");
    const endOfDayUTC = date.toUTC().endOf("day");

    const existingAppointments = await AppointmentModel.find({
      startTimeUTC: {
        $gte: startOfDayUTC.toJSDate(),
        $lt: endOfDayUTC.toJSDate(),
      },
      status: { $ne: "cancelled" },
    });

    // Generate available time slots (returns UTC times)
    const timeSlots = generateTimeSlots(
      availability,
      date,
      existingAppointments
    );

    return NextResponse.json({ 
      timeSlots,
      date: dateStr,
      timezone: availability.admintimezone 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}