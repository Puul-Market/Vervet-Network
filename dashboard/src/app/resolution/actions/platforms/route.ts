import { NextResponse } from "next/server";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  fetchSupportedPlatforms,
  type SupportedPlatformLookupMode,
} from "@/lib/vervet-api";

export async function GET(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim() ?? "";
  const chain = searchParams.get("chain")?.trim() ?? "";
  const asset = searchParams.get("asset")?.trim() ?? "";
  const lookupModeValue = searchParams.get("lookupMode")?.trim() ?? "";
  const lookupMode =
    lookupModeValue === "BY_ADDRESS" || lookupModeValue === "BY_RECIPIENT"
      ? (lookupModeValue as SupportedPlatformLookupMode)
      : undefined;

  try {
    const platforms = await fetchSupportedPlatforms(session.accessToken, {
      address: address.length > 0 ? address : undefined,
      chain: chain.length > 0 ? chain : undefined,
      asset: asset.length > 0 ? asset : undefined,
      lookupMode,
    });

    return NextResponse.json(platforms);
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.json(
        { message: "Your session is no longer valid." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "The dashboard could not load supported platforms.",
      },
      { status: 500 },
    );
  }
}
