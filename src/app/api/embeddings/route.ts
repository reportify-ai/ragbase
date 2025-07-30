import { NextRequest, NextResponse } from 'next/server';
import {
  getAllEmbeddingModels,
  createEmbeddingModel,
  updateEmbeddingModel,
  deleteEmbeddingModel,
} from './db';

export async function GET() {
  const models = await getAllEmbeddingModels();
  return NextResponse.json(models);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const model = await createEmbeddingModel(data);
  return NextResponse.json(model);
}

export async function PUT(req: NextRequest) {
  const data = await req.json();
  await updateEmbeddingModel(data.id, data);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await deleteEmbeddingModel(id);
  return NextResponse.json({ success: true });
} 