import { NextResponse } from "next/server";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  batchVerifyDestinations,
  DashboardAuthError,
  type BatchVerifyRecord,
  fetchPartnerDashboardMetadata,
  type ResolutionBatchLookupMode,
  type ResolutionBatchRowLookupMode,
  type ResolutionBatchInputFormat,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      inputFormat?: string;
      lookupMode?: string;
      chain?: string;
      asset?: string;
      input?: string;
      stopOnFirstHighRisk?: boolean;
      requireExactAttestedMatch?: boolean;
    };

    if (
      typeof body.chain !== "string" ||
      body.chain.trim().length === 0 ||
      typeof body.asset !== "string" ||
      body.asset.trim().length === 0 ||
      typeof body.input !== "string" ||
      body.input.trim().length === 0
    ) {
      return NextResponse.json(
        { message: "Chain, asset, and batch input are required." },
        { status: 400 },
      );
    }

    const metadata = await fetchPartnerDashboardMetadata(session.accessToken);
    const inputFormat = readBatchFormat(
      body.inputFormat,
      metadata.optionSets.resolutionBatchInputFormats,
    );
    const lookupMode = readBatchLookupMode(
      body.lookupMode,
      metadata.optionSets.resolutionBatchLookupModes,
    );

    if (!inputFormat || !lookupMode) {
      return NextResponse.json(
        { message: "Choose a supported input format and lookup mode." },
        { status: 400 },
      );
    }

    const rows = parseBatchRows(inputFormat, lookupMode, body.input);

    if (rows.length === 0) {
      return NextResponse.json(
        { message: "At least one batch row is required." },
        { status: 400 },
      );
    }

    const result = await batchVerifyDestinations(session.accessToken, {
      inputFormat,
      lookupMode,
      chain: body.chain.trim(),
      asset: body.asset.trim(),
      stopOnFirstHighRisk: body.stopOnFirstHighRisk === true,
      requireExactAttestedMatch: body.requireExactAttestedMatch === true,
      rows,
    });

    return NextResponse.json(result satisfies BatchVerifyRecord);
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
            : "The dashboard could not run the batch verification.",
      },
      { status: 500 },
    );
  }
}

function readBatchFormat(
  value: string | undefined,
  options: readonly ResolutionBatchInputFormat[],
): ResolutionBatchInputFormat | null {
  if (typeof value === "string" && options.includes(value as ResolutionBatchInputFormat)) {
    return value as ResolutionBatchInputFormat;
  }

  return null;
}

function readBatchLookupMode(
  value: string | undefined,
  options: readonly ResolutionBatchLookupMode[],
): ResolutionBatchLookupMode | null {
  if (typeof value === "string" && options.includes(value as ResolutionBatchLookupMode)) {
    return value as ResolutionBatchLookupMode;
  }

  return null;
}

function parseBatchRows(
  inputFormat: ResolutionBatchInputFormat,
  lookupMode: ResolutionBatchLookupMode,
  input: string,
): Array<{
  clientReference?: string;
  lookupMode?: ResolutionBatchRowLookupMode;
  platform?: string;
  recipientIdentifier?: string;
  address: string;
}> {
  switch (inputFormat) {
    case "JSON":
      return parseJsonRows(lookupMode, input);
    case "ROWS":
      return parseRowLines(lookupMode, input);
    case "CSV":
    default:
      return parseCsvRows(lookupMode, input);
  }
}

function parseJsonRows(
  lookupMode: ResolutionBatchLookupMode,
  input: string,
): Array<{
  clientReference?: string;
  lookupMode?: ResolutionBatchRowLookupMode;
  platform?: string;
  recipientIdentifier?: string;
  address: string;
}> {
  const parsedValue = JSON.parse(input) as unknown;

  if (!Array.isArray(parsedValue)) {
    throw new Error("JSON input must be an array of rows.");
  }

  return parsedValue.flatMap((row) => {
    if (typeof row !== "object" || row === null) {
      return [];
    }

    const candidate = row as {
      clientReference?: unknown;
      lookupMode?: unknown;
      platform?: unknown;
      recipientIdentifier?: unknown;
      address?: unknown;
    };

    if (typeof candidate.address !== "string") {
      return [];
    }

    const rowLookupMode = normalizeRowLookupMode(lookupMode, candidate.lookupMode);

    if (
      rowLookupMode === "BY_RECIPIENT" &&
      typeof candidate.recipientIdentifier !== "string"
    ) {
      return [];
    }

    if (rowLookupMode === "BY_ADDRESS" && typeof candidate.platform !== "string") {
      return [];
    }

    return [
      {
        ...(rowLookupMode ? { lookupMode: rowLookupMode } : {}),
        ...(typeof candidate.platform === "string" &&
        candidate.platform.trim().length > 0
          ? { platform: candidate.platform.trim() }
          : {}),
        ...(typeof candidate.recipientIdentifier === "string" &&
        candidate.recipientIdentifier.trim().length > 0
          ? { recipientIdentifier: candidate.recipientIdentifier.trim() }
          : {}),
        address: candidate.address.trim(),
        ...(typeof candidate.clientReference === "string" &&
        candidate.clientReference.trim().length > 0
          ? { clientReference: candidate.clientReference.trim() }
          : {}),
      },
    ];
  });
}

function parseRowLines(
  lookupMode: ResolutionBatchLookupMode,
  input: string,
): Array<{
  clientReference?: string;
  lookupMode?: ResolutionBatchRowLookupMode;
  platform?: string;
  recipientIdentifier?: string;
  address: string;
}> {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const columns = line.split("|").map((value) => value.trim());

      if (lookupMode === "MIXED") {
        const hasClientReference = columns[0] !== "BY_RECIPIENT" && columns[0] !== "BY_ADDRESS";
        const offset = hasClientReference ? 1 : 0;
        const rowLookupMode = normalizeRowLookupMode(lookupMode, columns[offset]);

        if (rowLookupMode === "BY_RECIPIENT" && columns[offset + 1] && columns[offset + 2]) {
          return [
            {
              clientReference: hasClientReference ? columns[0] || undefined : undefined,
              lookupMode: rowLookupMode,
              recipientIdentifier: columns[offset + 1],
              address: columns[offset + 2],
            },
          ];
        }

        if (rowLookupMode === "BY_ADDRESS" && columns[offset + 1] && columns[offset + 2]) {
          return [
            {
              clientReference: hasClientReference ? columns[0] || undefined : undefined,
              lookupMode: rowLookupMode,
              platform: columns[offset + 1],
              address: columns[offset + 2],
            },
          ];
        }

        return [];
      }

      const [clientReference, recipientIdentifierOrPlatform, address] = columns;

      if (!recipientIdentifierOrPlatform || !address) {
        return [];
      }

      return [
        {
          ...(lookupMode === "BY_ADDRESS"
            ? { platform: recipientIdentifierOrPlatform }
            : { recipientIdentifier: recipientIdentifierOrPlatform }),
          address,
          ...(clientReference ? { clientReference } : {}),
        },
      ];
    });
}

function parseCsvRows(
  lookupMode: ResolutionBatchLookupMode,
  input: string,
): Array<{
  clientReference?: string;
  lookupMode?: ResolutionBatchRowLookupMode;
  platform?: string;
  recipientIdentifier?: string;
  address: string;
}> {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line, index) => {
      const columns = line.split(",").map((value) => value.trim());

      if (
        index === 0 &&
        columns[0]?.toLowerCase().includes("client")
      ) {
        return [];
      }

      if (lookupMode === "MIXED" && columns.length >= 4) {
        const rowLookupMode = normalizeRowLookupMode(lookupMode, columns[1]);

        if (rowLookupMode === "BY_RECIPIENT") {
          return [
            {
              clientReference: columns[0] || undefined,
              lookupMode: rowLookupMode,
              recipientIdentifier: columns[2],
              address: columns[3],
            },
          ];
        }

        if (rowLookupMode === "BY_ADDRESS") {
          return [
            {
              clientReference: columns[0] || undefined,
              lookupMode: rowLookupMode,
              platform: columns[2],
              address: columns[3],
            },
          ];
        }
      }

      if (columns.length >= 3) {
        return [
          {
            clientReference: columns[0] || undefined,
            ...(lookupMode === "BY_ADDRESS"
              ? { platform: columns[1] }
              : { recipientIdentifier: columns[1] }),
            address: columns[2],
          },
        ];
      }

      if (columns.length === 2) {
        return [
          {
            ...(lookupMode === "BY_ADDRESS"
              ? { platform: columns[0] }
              : { recipientIdentifier: columns[0] }),
            address: columns[1],
          },
        ];
      }

      return [];
    });
}

function normalizeRowLookupMode(
  lookupMode: ResolutionBatchLookupMode,
  candidate: unknown,
): ResolutionBatchRowLookupMode | undefined {
  if (lookupMode !== "MIXED") {
    return lookupMode === "BY_ADDRESS" ? "BY_ADDRESS" : "BY_RECIPIENT";
  }

  if (candidate === "BY_ADDRESS") {
    return "BY_ADDRESS";
  }

  if (candidate === "BY_RECIPIENT") {
    return "BY_RECIPIENT";
  }

  return undefined;
}
