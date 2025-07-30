import { db } from '../../../../db';
import { syncDirectoryLogs } from '../../../../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

export async function getSyncLogsByDirectoryId(syncDirectoryId: number, limit = 20, offset = 0) {
  return db.select()
    .from(syncDirectoryLogs)
    .where(eq(syncDirectoryLogs.syncDirectoryId, syncDirectoryId))
    .orderBy(desc(syncDirectoryLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getSyncLogsByKbId(kbId: number, limit = 20, offset = 0) {
  return db.select()
    .from(syncDirectoryLogs)
    .where(eq(syncDirectoryLogs.kbId, kbId))
    .orderBy(desc(syncDirectoryLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getSyncLogById(id: number) {
  const [row] = await db.select()
    .from(syncDirectoryLogs)
    .where(eq(syncDirectoryLogs.id, id));
  return row;
}

export async function createSyncLog(data: Omit<typeof syncDirectoryLogs.$inferInsert, 'id'>) {
  const [row] = await db.insert(syncDirectoryLogs).values(data).returning();
  return row;
}

export async function updateSyncLog(id: number, data: Partial<typeof syncDirectoryLogs.$inferInsert>) {
  const [row] = await db.update(syncDirectoryLogs)
    .set(data)
    .where(eq(syncDirectoryLogs.id, id))
    .returning();
  return row;
}

export async function getSyncLogsCount(syncDirectoryId?: number, kbId?: number) {
  if (syncDirectoryId && kbId) {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(syncDirectoryLogs)
      .where(and(
        eq(syncDirectoryLogs.syncDirectoryId, syncDirectoryId),
        eq(syncDirectoryLogs.kbId, kbId)
      ));
    return result?.count || 0;
  } else if (syncDirectoryId) {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(syncDirectoryLogs)
      .where(eq(syncDirectoryLogs.syncDirectoryId, syncDirectoryId));
    return result?.count || 0;
  } else if (kbId) {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(syncDirectoryLogs)
      .where(eq(syncDirectoryLogs.kbId, kbId));
    return result?.count || 0;
  } else {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(syncDirectoryLogs);
    return result?.count || 0;
  }
} 