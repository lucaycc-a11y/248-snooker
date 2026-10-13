import { NextResponse } from "next/server";

/**
 * POST /api/member/delete-data — retired.
 *
 * Account deletion is now a two-step, code-verified soft delete with a
 * 180-day purge window:
 *   POST /api/member/delete-account/send-code
 *   POST /api/member/delete-account/confirm
 * The immediate-anonymise RPC this route used to call has been dropped.
 */
export async function POST() {
  return NextResponse.json(
    { success: false, code: "endpoint_moved", message: "Use /api/member/delete-account" },
    { status: 410 }
  );
}
