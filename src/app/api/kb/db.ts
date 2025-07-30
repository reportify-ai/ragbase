import { db } from '../../../db';
import { kbs, syncDirectories, files } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export async function getAllKbs() {
  return db.select().from(kbs).orderBy(kbs.id);
}

export async function createKb(data: Omit<typeof kbs.$inferInsert, 'id'>) {
  const [row] = await db.insert(kbs).values(data).returning();
  return row;
}

export async function updateKb(id: number, data: Partial<typeof kbs.$inferInsert>) {
  const [row] = await db.update(kbs).set(data).where(eq(kbs.id, id)).returning();
  return row;
}

export async function deleteKb(id: number) {
  await db.delete(kbs).where(eq(kbs.id, id));
} 