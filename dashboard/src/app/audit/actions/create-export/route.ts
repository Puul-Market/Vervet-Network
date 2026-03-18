import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import {
  readOptionalEnumField,
  readOptionalTextField,
  readRequiredEnumField,
} from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  createAuditExport,
  DashboardAuthError,
  humanizeDashboardError,
  type AuditActorType,
  type AuditExportFormat,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const format = readRequiredEnumField<AuditExportFormat>(formData.get("format"));
  const actorType = readOptionalEnumField<AuditActorType>(formData.get("actorType"));
  const action = readOptionalTextField(formData.get("action"));
  const entityType = readOptionalTextField(formData.get("entityType"));
  const dateFrom = readOptionalTextField(formData.get("dateFrom"));
  const dateTo = readOptionalTextField(formData.get("dateTo"));

  if (!format) {
    await setDashboardFlash({
      level: "error",
      title: "Audit export failed",
      message: "Select a supported export format.",
    });

    return NextResponse.redirect(new URL("/audit/exports", request.url), 303);
  }

  try {
    const exportJob = await createAuditExport(session.accessToken, {
      format,
      ...(actorType ? { actorType } : {}),
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    });

    await setDashboardFlash({
      level: "success",
      title: "Audit export requested",
      message: `Export ${exportJob.id} is now ${exportJob.status.toLowerCase()}.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Audit export failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(new URL("/audit/exports", request.url), 303);
}
