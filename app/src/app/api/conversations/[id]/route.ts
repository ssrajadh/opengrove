import { NextRequest, NextResponse } from "next/server";
import {
  getConversation,
  getFullHistory,
  deleteConversation,
  deleteChunksForConversation,
  reparentChildren,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Re-parent direct children so branches aren't orphaned
  reparentChildren(id);
  // Clean up vector chunks (virtual table isn't covered by CASCADE)
  deleteChunksForConversation(id);
  await deleteConversation(id);
  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const messages = await getFullHistory(id);
  return NextResponse.json({ ...conversation, messages });
}
