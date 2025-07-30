import { db } from '../../../db';
import { embeddingModels } from '../../../db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function getAllEmbeddingModels() {
  return db.select().from(embeddingModels).orderBy(embeddingModels.id);
}

export async function getEmbeddingModelById(id: number) {
  const [model] = await db.select().from(embeddingModels).where(eq(embeddingModels.id, id));
  return model;
}

export async function getEmbeddingModelByName(name: string) {
  const [model] = await db.select().from(embeddingModels).where(eq(embeddingModels.name, name));
  return model;
}

export async function getDefaultEmbeddingModel() {
  const [model] = await db.select().from(embeddingModels).where(eq(embeddingModels.is_default, true));
  return model;
}

export async function setDefaultEmbeddingModel(id: number) {
  try {
    // Set all models to non-default first
    await db.update(embeddingModels)
      .set({ is_default: false })
      .where(eq(embeddingModels.is_default, true));
    
    // Then set the specified model to default
    await db.update(embeddingModels)
      .set({ is_default: true })
      .where(eq(embeddingModels.id, id));
    
    return true;
  } catch (error) {
    console.error('设置默认嵌入模型失败:', error);
    return false;
  }
}

export async function createEmbeddingModel(data: Omit<typeof embeddingModels.$inferInsert, 'id'>) {
  // If set to default, first set other models' default status to false
  if (data.is_default) {
    await db.update(embeddingModels)
      .set({ is_default: false })
      .where(eq(embeddingModels.is_default, true));
  }
  
  const [row] = await db.insert(embeddingModels).values(data).returning();
  return row;
}

export async function updateEmbeddingModel(id: number, data: Partial<typeof embeddingModels.$inferInsert>) {
  if (!data || typeof data !== 'object') throw new Error('updateEmbeddingModel: data is required');
  
  // If set to default, first set other models' default status to false
  if (data.is_default) {
    await db.update(embeddingModels)
      .set({ is_default: false })
      .where(eq(embeddingModels.is_default, true));
  }
  
  const [row] = await db.update(embeddingModels).set(data).where(eq(embeddingModels.id, id)).returning();
  return row;
}

export async function deleteEmbeddingModel(id: number) {
  // First check if the model to delete is the default model
  const modelToDelete = await getEmbeddingModelById(id);
  
  // Delete model
  await db.delete(embeddingModels).where(eq(embeddingModels.id, id));
  
  // If the model to delete is the default model, try to set a new default model
  if (modelToDelete?.is_default) {
    const remainingModels = await getAllEmbeddingModels();
    if (remainingModels.length > 0) {
      await db.update(embeddingModels)
        .set({ is_default: true })
        .where(eq(embeddingModels.id, remainingModels[0].id));
    }
  }
} 