import { db } from '../../../db';
import { models } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export async function getAllModels() {
  return db.select().from(models).orderBy(models.id);
}

export async function getDefaultModel() {
  const result = await db.select().from(models).where(eq(models.is_default, true)).limit(1);
  return result[0] || null;
}

export async function createModel(data: Omit<typeof models.$inferInsert, 'id'>) {
  // 如果设置为默认模型，先将其他模型的默认状态清除
  if (data.is_default) {
    await db.update(models)
      .set({ is_default: false })
      .where(eq(models.is_default, true));
  }
  
  const [row] = await db.insert(models).values(data).returning();
  return row;
}

export async function updateModel(id: number, data: Partial<typeof models.$inferInsert>) {
  // 如果设置为默认模型，先将其他模型的默认状态清除
  if (data.is_default) {
    await db.update(models)
      .set({ is_default: false })
      .where(eq(models.is_default, true));
  }
  
  const [row] = await db.update(models).set(data).where(eq(models.id, id)).returning();
  return row;
}

export async function deleteModel(id: number) {
  await db.delete(models).where(eq(models.id, id));
} 