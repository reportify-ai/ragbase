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
  const { id } = await req.json();
  await deleteKb(id);
  return NextResponse.json({ success: true });
}