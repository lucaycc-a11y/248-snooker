import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const botUrl = process.env.WHATSAPP_BOT_URL;
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET;

    if (!botUrl || !webhookSecret) {
      return NextResponse.json({ error: "WhatsApp bot is not configured" }, { status: 500 });
    }

    const { phone } = await request.json();
    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Phone required" }, { status: 400 });
    }

    const response = await fetch(`${botUrl}/api/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": webhookSecret,
      },
      body: JSON.stringify({ phone }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({ error: "Invalid bot response" }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("WhatsApp OTP proxy error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
