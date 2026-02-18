import { NextRequest, NextResponse } from "next/server";
import { getConversation, getMessages } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const messages = await getMessages(id);
  return NextResponse.json({ ...conversation, messages });
}
