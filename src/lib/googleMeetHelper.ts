import { google, calendar_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";

// Initialize Google Calendar API
const calendar = google.calendar({ version: "v3" });

// Required scopes
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar",
];

// Enhanced authentication with better error handling
async function authorize(): Promise<OAuth2Client> {
  const requiredEnvVars = {
    GOOGLE_CLIENT_ID: "Google OAuth Client ID",
    GOOGLE_CLIENT_SECRET: "Google OAuth Client Secret",
    GOOGLE_REDIRECT_URI: "Google OAuth Redirect URI",
    GOOGLE_REFRESH_TOKEN: "Google OAuth Refresh Token",
  };

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([varName]) => !process.env[varName])
    .map(([, description]) => description);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missingVars.join("\n")}`
    );
  }

  try {
    const oAuth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oAuth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    return oAuth2Client;
  } catch (error) {
    console.error("❌ Authorization failed:", error);
    throw new Error("Failed to authenticate with Google");
  }
}

// MAIN FIX: Create properly scheduled Google Meet that shows correct status for both admin and client
export async function createScheduledGoogleMeet(
  startTime: Date,
  endTime: Date,
  title: string,
  description?: string,
  clientEmail?: string
): Promise<{ meetLink: string; eventId: string; eventLink: string }> {
  try {
    const authClient = await authorize();

    // CRITICAL: Ensure times are at least 2 minutes in the future
    const now = new Date();
    const minStartTime = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes from now

    if (startTime < minStartTime) {
      console.log(
        `⚠️  Adjusting start time to minimum required: ${minStartTime.toISOString()}`
      );
      startTime = minStartTime;
      // Adjust end time accordingly if needed
      if (endTime <= startTime) {
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration
      }
    }

    // Generate a consistent conference request ID
    const conferenceRequestId = `scheduled_meet_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;

    const event: calendar_v3.Schema$Event = {
      summary: title,
      description: description || "Scheduled Meeting",
      start: {
        dateTime: startTime.toISOString(),
        timeZone: "UTC", // Keep UTC for consistency
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: "UTC",
      },
      // CRITICAL: Proper attendee configuration
      attendees: clientEmail
        ? [
            {
              email: clientEmail,
              responseStatus: "needsAction", // Let client accept normally
              optional: false,
              displayName: "Meeting Attendee",
            },
          ]
        : [],
      // CRITICAL: Conference data that creates a SCHEDULED meeting
      conferenceData: {
        createRequest: {
          requestId: conferenceRequestId,
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
          // IMPORTANT: Add status to make it scheduled
          status: {
            statusCode: "success",
          },
        },
        // Pre-define entry points
        entryPoints: [],
        conferenceSolution: {
          key: { type: "hangoutsMeet" },
          name: "Google Meet",
          iconUri:
            "https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v6/web-512dp/logo_meet_2020q4_color_2x_web_512dp.png",
        },
      },
      // Event settings for proper scheduling
      eventType: "default",
      status: "confirmed",
      visibility: "default",
      transparency: "opaque",

      // Guest permissions - CRITICAL for scheduled meeting behavior
      guestsCanInviteOthers: false, // Prevent random invites
      guestsCanSeeOtherGuests: true,
      guestsCanModify: false,

      // // Reminders to make it feel more "scheduled"
      // reminders: {
      //   useDefault: false,
      //   overrides: [
      //     { method: "email", minutes: 24 * 60 }, // 1 day before
      //     { method: "popup", minutes: 15 }, // 15 minutes before
      //   ],
      // },

      // Source to indicate it's a scheduled event
      source: {
        title: "Scheduled Meeting System",
        url: "https://calendar.google.com",
      },
    };

    // console.log("🔄 Creating scheduled Google Meet event...");
    // console.log("📅 Start:", startTime.toISOString());
    // console.log("📅 End:", endTime.toISOString());
    // console.log("👤 Attendee:", clientEmail || "None");

    // Create the event with conference data
    const response = await calendar.events.insert({
      auth: authClient,
      calendarId: "primary",
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: clientEmail ? "all" : "none", // Send invites if there are attendees
      sendNotifications: true,
      supportsAttachments: false,
    });

    if (!response.data.id) {
      throw new Error("Failed to create calendar event");
    }

    console.log("✅ Event created with ID:", response.data.id);

    // CRITICAL STEP: Wait a moment then fetch the event to get the final Meet link
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

    const finalEvent = await calendar.events.get({
      auth: authClient,
      calendarId: "primary",
      eventId: response.data.id,
    });

    const meetLink = finalEvent.data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === "video"
    )?.uri;

    if (!meetLink) {
      console.error(
        "Conference data:",
        JSON.stringify(finalEvent.data.conferenceData, null, 2)
      );
      throw new Error("Google Meet link was not generated");
    }

    // ADDITIONAL STEP: Ensure the meeting is properly bound to the calendar event
    if (clientEmail) {
      console.log("🔄 Ensuring proper attendee access...");

      await calendar.events.patch({
        auth: authClient,
        calendarId: "primary",
        eventId: response.data.id,
        requestBody: {
          // Confirm the attendee setup
          attendees: [
            {
              email: clientEmail,
              responseStatus: "needsAction", // Let them accept invitation properly
              optional: false,
            },
          ],
        },
        sendUpdates: "all",
      });
    }

    console.log("✅ Scheduled Google Meet created successfully!");
    console.log("🔗 Meet Link:", meetLink);
    console.log("📅 Calendar Link:", finalEvent.data.htmlLink);
    console.log(
      "🕐 Meeting Time:",
      startTime.toLocaleString(),
      "to",
      endTime.toLocaleString()
    );

    return {
      meetLink: meetLink,
      eventId: response.data.id,
      eventLink: finalEvent.data.htmlLink || "",
    };
  } catch (error) {
    console.error("❌ Error creating scheduled Google Meet:", error);
    throw new Error(
      `Failed to create scheduled Google Meet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// ALTERNATIVE METHOD: Create meeting that definitely shows as scheduled
export async function createCalendarScheduledMeet(
  startTime: Date,
  endTime: Date,
  title: string,
  description?: string,
  clientEmail?: string
): Promise<{ meetLink: string; calendarLink: string }> {
  try {
    const authClient = await authorize();

    // Step 1: Create calendar event WITHOUT Google Meet first
    console.log("📅 Step 1: Creating calendar event...");

    const calendarEvent: calendar_v3.Schema$Event = {
      summary: title,
      description: `${
        description || "Scheduled Meeting"
      }\n\n🔗 Google Meet link will be added automatically.`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: "UTC",
      },
      attendees: clientEmail
        ? [
            {
              email: clientEmail,
              optional: false,
            },
          ]
        : [],
      status: "confirmed",
      eventType: "default",
    };

    const eventResponse = await calendar.events.insert({
      auth: authClient,
      calendarId: "primary",
      requestBody: calendarEvent,
      sendUpdates: "none", // Don't send yet
    });

    if (!eventResponse.data.id) {
      throw new Error("Failed to create calendar event");
    }

    console.log("✅ Calendar event created:", eventResponse.data.id);

    // Step 2: Add Google Meet to the existing calendar event
    console.log("🔄 Step 2: Adding Google Meet to calendar event...");

    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

    const meetUpdate = await calendar.events.patch({
      auth: authClient,
      calendarId: "primary",
      eventId: eventResponse.data.id,
      requestBody: {
        conferenceData: {
          createRequest: {
            requestId: `calendar_meet_${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
      conferenceDataVersion: 1,
      sendUpdates: clientEmail ? "all" : "none", // Now send the complete invitation
      sendNotifications: true,
    });

    // Step 3: Get the final event with Meet link
    console.log("🔄 Step 3: Retrieving final event details...");

    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

    const finalEventResponse = await calendar.events.get({
      auth: authClient,
      calendarId: "primary",
      eventId: eventResponse.data.id,
    });

    const meetLink = finalEventResponse.data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === "video"
    )?.uri;

    if (!meetLink) {
      throw new Error("Failed to generate Google Meet link for calendar event");
    }

    console.log("✅ Calendar-scheduled Google Meet created!");
    console.log("🔗 Meet Link:", meetLink);
    console.log("📅 Calendar Link:", finalEventResponse.data.htmlLink);

    // The key difference: This creates a meeting that's BOUND to a calendar event
    // When users click the Meet link, Google knows it's a scheduled meeting from calendar

    return {
      meetLink: meetLink,
      calendarLink: finalEventResponse.data.htmlLink || "",
    };
  } catch (error) {
    console.error("❌ Error creating calendar-scheduled meet:", error);
    throw new Error(
      `Failed to create calendar-scheduled meet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Enhanced test function

// Utility function to verify meeting status
export async function verifyMeetingStatus(eventId: string): Promise<void> {
  try {
    const authClient = await authorize();

    const event = await calendar.events.get({
      auth: authClient,
      calendarId: "primary",
      eventId: eventId,
    });

    console.log("🔍 Meeting Status Verification:");
    console.log("   Title:", event.data.summary);
    console.log("   Status:", event.data.status);
    console.log("   Event Type:", event.data.eventType);
    console.log("   Start:", event.data.start?.dateTime);
    console.log("   End:", event.data.end?.dateTime);
    console.log(
      "   Has Meet:",
      !!event.data.conferenceData?.entryPoints?.length
    );
    console.log(
      "   Meet Link:",
      event.data.conferenceData?.entryPoints?.[0]?.uri
    );
    console.log(
      "   Attendees:",
      event.data.attendees?.map((a) => `${a.email} (${a.responseStatus})`)
    );
    console.log("   Calendar Link:", event.data.htmlLink);
  } catch (error) {
    console.error("❌ Error verifying meeting status:", error);
  }
}

// FIXED: Export function that returns just the Meet link string (for backward compatibility)
export async function createGoogleMeetEvent(
  startTime: Date,
  endTime: Date,
  title: string,
  description?: string,
  clientEmail?: string
): Promise<string> {
  const result = await createCalendarScheduledMeet(
    startTime,
    endTime,
    title,
    description,
    clientEmail
  );
  return result.meetLink; // Return only the Meet link string
}

// Export the full result version if you need both links
export const createGoogleMeetEventFull = createCalendarScheduledMeet;
