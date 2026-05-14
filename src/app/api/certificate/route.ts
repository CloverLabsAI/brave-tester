import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { resultsHash, payload } = body;

    if (!resultsHash || !payload) {
      return NextResponse.json({ error: "Missing resultsHash or payload" }, { status: 400 });
    }

    // Generate certificate ID
    const id = crypto.randomUUID();

    // Sign with HMAC-SHA256
    const secret = process.env.CERT_SECRET || "brave-tester-dev-secret";
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(resultsHash)
    );
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return NextResponse.json({
      id,
      signature,
      resultsHash,
      ...payload,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
