import { NextRequest, NextResponse } from 'next/server';
import {
  getAllKbs,
  createKb,
  updateKb,
  deleteKb,
} from './db';

export async function GET() {
  const kbs = await getAllKbs();
  return NextResponse.json(kbs);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const kb = await createKb(data);
  return NextResponse.json(kb);
}

export async function PUT(req: NextRequest) {
  const data = await req.json();
  await updateKb(data.id, data);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    
    if (!id) {
      return NextResponse.json(
        { error: "Knowledge base ID is required" },
        { status: 400 }
      );
    }

    console.log(`[API] Starting deletion of knowledge base ${id}`);
    const result = await deleteKb(id);
    
    if (result.success) {
      console.log(`[API] Knowledge base ${id} deleted successfully:`, result.stats);
      return NextResponse.json({
        success: true,
        message: "Knowledge base and all related data deleted successfully",
        stats: result.stats,
        errors: result.errors
      });
    } else {
      console.error(`[API] Knowledge base ${id} deletion failed:`, result.errors);
      return NextResponse.json({
        success: false,
        error: "Knowledge base deletion failed",
        stats: result.stats,
        errors: result.errors
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Knowledge base deletion API error:", error);
    return NextResponse.json(
      { 
        error: "Knowledge base deletion failed", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}