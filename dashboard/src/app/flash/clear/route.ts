import { NextResponse } from "next/server";
import { clearDashboardFlash } from "@/lib/flash";

export async function POST() {
  await clearDashboardFlash();

  return new NextResponse(null, {
    status: 204,
  });
}
