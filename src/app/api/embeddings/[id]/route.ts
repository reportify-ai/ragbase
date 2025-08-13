import { NextRequest, NextResponse } from 'next/server';
import { updateEmbeddingModel, deleteEmbeddingModel } from '../db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid ID format" },
        { status: 400 }
      );
    }

    const data = await req.json();
    const model = await updateEmbeddingModel(id, data);
    return NextResponse.json(model);
  } catch (error) {
    console.error("Update embedding model error:", error);
    return NextResponse.json(
      { error: `Failed to update embedding model: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid ID format" },
        { status: 400 }
      );
    }

    await deleteEmbeddingModel(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete embedding model error:", error);
    return NextResponse.json(
      { error: `Failed to delete embedding model: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
