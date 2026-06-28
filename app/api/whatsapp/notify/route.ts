import { NextResponse } from "next/server";

const NOTIFICATION_ENDPOINTS = {
  "booking-confirmed": "booking-confirmed",
  reminder: "reminder",
  "session-ending": "session-ending",
} as const;

type NotificationType = keyof typeof NOTIFICATION_ENDPOINTS;

export async function POST(request: Request) {
  try {
    const botUrl = process.env.WHATSAPP_BOT_URL;
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET;

    if (!botUrl || !webhookSecret) {
      return NextResponse.json({ error: "WhatsApp bot is not configured" }, { status: 500 });
    }

    const body = await request.json();
    const type = body?.type as NotificationType | undefined;

    if (!type || !(type in NOTIFICATION_ENDPOINTS)) {
      return NextResponse.json({ error: "Invalid notification type" }, { status: 400 });
    }

    const response = await fetch(`${botUrl}/api/notify/${NOTIFICATION_ENDPOINTS[type]}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": webhookSecret,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({ error: "Invalid bot response" }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("WhatsApp notification proxy error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
