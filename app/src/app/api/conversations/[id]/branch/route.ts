import { NextRequest, NextResponse } from "next/server";
import { getConversation, createBranch } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: parentId } = await params;

  const parent = await getConversation(parentId);
  if (!parent) {
    return NextResponse.json({ error: "Parent conversation not found" }, { status: 404 });
  }

  const body = (await req.json()) as { messageIndex: number };
  const { messageIndex } = body;

  if (typeof messageIndex !== "number" || messageIndex < 0) {
    return NextResponse.json(
      { error: "messageIndex must be a non-negative integer" },
      { status: 400 },
    );
  }

  try {
    const branchId = await createBranch(parentId, messageIndex);
    const conversation = await getConversation(branchId);
    return NextResponse.json(conversation, { status: 201 });
  } catch (err) {
    console.error("Branch creation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Branch creation failed" },
      { status: 500 },
    );
  }
}
