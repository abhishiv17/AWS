import { NextResponse } from "next/server";

const mockDb = new Map<string, any>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  
  if (!code) {
    return NextResponse.json({ error: "Room code required" }, { status: 400 });
  }

  const projection = mockDb.get(code.toUpperCase());
  return NextResponse.json({ projection: projection ?? null });
}

export async function POST(request: Request) {
  try {
    const projection = await request.json();
    if (!projection?.room?.code) {
      return NextResponse.json({ error: "Invalid projection data" }, { status: 400 });
    }
    mockDb.set(projection.room.code.toUpperCase(), projection);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to parse JSON" }, { status: 400 });
  }
}