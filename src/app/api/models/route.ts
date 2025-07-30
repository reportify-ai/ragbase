import { NextRequest, NextResponse } from 'next/server';
import {
  getAllModels,
  createModel,
  updateModel,
  deleteModel,
} from './db';

export async function GET() {
  const models = await getAllModels();
  return NextResponse.json(models);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const model = await createModel(data);
  return NextResponse.json(model);
}

export async function PUT(req: NextRequest) {
  const data = await req.json();
  await updateModel(data.id, data);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await deleteModel(id);
  return NextResponse.json({ success: true });
} 