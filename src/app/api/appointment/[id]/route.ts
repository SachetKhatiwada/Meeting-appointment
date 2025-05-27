import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import AppointmentModel from "@/model/Appointment";

// DELETE Appointment by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const deleted = await AppointmentModel.findByIdAndDelete(params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { message: "Deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// UPDATE Appointment (status or reminders)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const body = await req.json();

    const updateFields: any = {};
    if (body.status) updateFields.status = body.status;
    if (body.remindersSent) updateFields.remindersSent = body.remindersSent;

    const updated = await AppointmentModel.findByIdAndUpdate(
      params.id,
      { $set: updateFields },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
