import dbConnect from "@/lib/dbConnect";
import AvailabilityModel from "@/model/Availability";
import AppointmentModel from "@/model/Appointment";
import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { createGoogleMeetEvent } from "@/lib/googleMeetHelper";
import { sendConfirmationEmail } from "@/lib/sendEmail";

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

// POST create a new appointment
export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const {
      startTimeUTC,
      appointmentTitle,
      description,
      clientEmail,
      clientTimezone,
    } = body;

    if (!startTimeUTC) {
      return NextResponse.json(
        { error: "startTimeUTC is required" },
        { status: 400 }
      );
    }

    const availability = await AvailabilityModel.findOne();
    if (!availability) {
      return NextResponse.json(
        { error: "Availability settings not found" },
        { status: 404 }
      );
    }

    const appointmentStartUTC = DateTime.fromISO(startTimeUTC);
    if (appointmentStartUTC < DateTime.utc()) {
      return NextResponse.json(
        { error: "Appointment must be in the future" },
        { status: 400 }
      );
    }

    const appointmentEndUTC = appointmentStartUTC.plus({
      minutes: availability.slotDuration,
    });

    const appointmentDate = appointmentStartUTC.startOf("day");
    const workStartUTC = convertLocalToUTC(
      availability.startTime,
      availability.admintimezone,
      appointmentDate
    );
    const workEndUTC = convertLocalToUTC(
      availability.endTime,
      availability.admintimezone,
      appointmentDate
    );

    if (appointmentStartUTC < workStartUTC || appointmentEndUTC > workEndUTC) {
      return NextResponse.json(
        {
          error: `Appointment must be within admin's working hours (${availability.startTime} to ${availability.endTime} ${availability.admintimezone})`,
        },
        { status: 400 }
      );
    }

    const slotDuration = availability.slotDuration ?? 0;
    const bufferBetweenSlots = availability.bufferBetweenSlots ?? 0;
    const totalSlotDuration = slotDuration + bufferBetweenSlots;
    const workStart = convertLocalToUTC(
      availability.startTime,
      availability.admintimezone,
      appointmentDate
    );
    const minutesFromStart = appointmentStartUTC.diff(
      workStart,
      "minutes"
    ).minutes;

    if (minutesFromStart % totalSlotDuration !== 0) {
      const nextValidTime = workStart.plus({
        minutes:
          Math.ceil(minutesFromStart / totalSlotDuration) * totalSlotDuration,
      });

      return NextResponse.json(
        {
          error: "Appointment must start at a valid slot time",
          nextAvailableSlot: nextValidTime.toISO(),
        },
        { status: 400 }
      );
    }

    const conflictingAppointment = await AppointmentModel.findOne({
      startTimeUTC: { $lt: appointmentEndUTC.toJSDate() },
      endTimeUTC: { $gt: appointmentStartUTC.toJSDate() },
      status: { $ne: "cancelled" },
    });

    if (conflictingAppointment) {
      return NextResponse.json(
        { error: "Time slot is already booked" },
        { status: 409 }
      );
    }

    // ✅ Create appointment quickly WITHOUT Google Meet
    const newAppointment = await AppointmentModel.create({
      startTimeUTC: appointmentStartUTC.toJSDate(),
      endTimeUTC: appointmentEndUTC.toJSDate(),
      appointmentTitle: appointmentTitle || "Appointment",
      description: description || "",
      status: "scheduled",
      googleMeetLink: "", // Placeholder for now
      remindersSent: {
        confirmation: false,
        oneHourBefore: false,
      },
      clientEmail,
      clientTimezone,
    });

    // ✅ Respond immediately
    const responseAppointment = {
      ...newAppointment.toObject(),
      googleMeetLink: "",
    };
    const response = NextResponse.json(responseAppointment, { status: 201 });

    // 🧵 Background: Create meet link, update DB, send email
    (async () => {
      try {
        const meetLink = await createGoogleMeetEvent(
          appointmentStartUTC.toJSDate(),
          appointmentEndUTC.toJSDate(),
          appointmentTitle,
          description,
          clientEmail
        );

        console.log("Google Meet link created:", meetLink);

        function getFinalMeetLink(meetLink: unknown): string {
          if (typeof meetLink === "string" && meetLink.trim() !== "") {
            return meetLink;
          }
          if (
            meetLink &&
            typeof meetLink === "object" &&
            "meetLink" in meetLink &&
            typeof (meetLink as any).meetLink === "string" &&
            (meetLink as any).meetLink.trim() !== ""
          ) {
            return (meetLink as { meetLink: string }).meetLink;
          }
          return "Link not created";
        }

        const finalMeetLink = getFinalMeetLink(meetLink);

        // Update only the Google Meet link first
        await AppointmentModel.findByIdAndUpdate(newAppointment._id, {
          $set: {
            googleMeetLink: finalMeetLink,
          },
        });

        // Send email
        await sendConfirmationEmail({
          to: clientEmail,
          subject: "Appointment Confirmation",
          appointmentTitle: appointmentTitle || "Appointment",
          appointmentStartUTC: appointmentStartUTC.toISO() ?? "",
          appointmentEndUTC: appointmentEndUTC.toISO() ?? "",
          googleMeetLink: finalMeetLink,
          clientTimezone: clientTimezone ?? "",
        });

        // ✅ Only after successful email, update reminder status
        await AppointmentModel.findByIdAndUpdate(newAppointment._id, {
          $set: {
            "remindersSent.confirmation": true,
          },
        });
      } catch (err) {
        console.error("Error in background task:", err);
      }
    })();

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await dbConnect();
    const appointments = await AppointmentModel.find().sort({
      startTimeUTC: 1,
    });
    return NextResponse.json(appointments, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
