import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/member/delete-data
 *
 * Triggers member data deletion/anonymization per PDPO rights.
 * Calls the Supabase RPC `request_member_data_deletion()` which:
 * - Checks for active bookings (must be cancelled first)
 * - Anonymizes users table (display_name, phone, avatar)
 * - Deletes user_coupons, campaign_claims, referrals, future locker bookings
 * - Preserves bookings, points_ledger, payment_attempts (audit/legal requirement)
 * - Logs the request in data_deletion_requests table
 * - Deletes auth.users entry (signs user out)
 *
 * Returns: { success: boolean, message: string, requestId?: string }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    // Parse request body for verification code
    const body = await req.json().catch(() => ({}));
    const verificationCode = typeof body.verificationCode === 'string' ? body.verificationCode.trim() : '';

    if (!verificationCode) {
      return NextResponse.json(
        { success: false, message: "Verification code required" },
        { status: 400 }
      );
    }

    // Call the Supabase RPC with verification code
    const { data, error } = await supabase.rpc("request_member_data_deletion", {
      verification_code: verificationCode,
    });

    if (error) {
      console.error("[delete-data] RPC error:", error);
      return NextResponse.json(
        {
          success: false,
          message: `Database error: ${error.message}`,
        },
        { status: 500 }
      );
    }

    // RPC returns jsonb with { success, message, request_id? }
    const result = data as {
      success: boolean;
      message: string;
      request_id?: string;
    };

    if (!result.success) {
      // Business logic failure (e.g., active bookings, duplicate request)
      return NextResponse.json(
        {
          success: false,
          message: result.message,
        },
        { status: 400 }
      );
    }

    // Success — user will be signed out by the RPC (auth.users deleted)
    return NextResponse.json({
      success: true,
      message: result.message,
      requestId: result.request_id,
    });
  } catch (err) {
    console.error("[delete-data] Unexpected error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
