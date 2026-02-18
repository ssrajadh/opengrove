import { NextRequest, NextResponse } from "next/server";
import { getConversation, getMessages, deleteConversation, deleteChunksForConversation } from "@/lib/db";

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
  // Clean up vector chunks before deleting the conversation (cascade won't cover virtual table)
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
  const messages = await getMessages(id);
  return NextResponse.json({ ...conversation, messages });
}
