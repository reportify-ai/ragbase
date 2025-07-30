import { db } from '../../../../db';
import { syncDirectories, syncDirectoryLogs } from '../../../../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export async function getSyncDirectoriesByKbId(kbId: number) {
  return db.select().from(syncDirectories).where(eq(syncDirectories.kbId, kbId)).orderBy(syncDirectories.id);
}

export async function getSyncDirectoryById(id: number) {
  const [row] = await db.select().from(syncDirectories).where(eq(syncDirectories.id, id));
  return row;
}

export async function createSyncDirectory(data: Omit<typeof syncDirectories.$inferInsert, 'id'>) {
  const [row] = await db.insert(syncDirectories).values(data).returning();
  return row;
}

export async function updateSyncDirectory(id: number, data: Partial<typeof syncDirectories.$inferInsert>) {
  const [row] = await db.update(syncDirectories).set(data).where(eq(syncDirectories.id, id)).returning();
  return row;
}

export async function deleteSyncDirectory(id: number) {
  await db.delete(syncDirectories).where(eq(syncDirectories.id, id));
}

export async function getAllSyncDirectories() {
  return db.select().from(syncDirectories).orderBy(syncDirectories.id);
}

export async function checkSyncDirectoryExists(kbId: number, dirPath: string) {
  const [row] = await db.select().from(syncDirectories).where(
    and(
      eq(syncDirectories.kbId, kbId),
      eq(syncDirectories.dirPath, dirPath)
    )
  );
  return row;
}

export async function checkSyncDirectoryExistsExcludeId(kbId: number, dirPath: string, excludeId: number) {
  const [row] = await db.select().from(syncDirectories).where(
    and(
      eq(syncDirectories.kbId, kbId),
      eq(syncDirectories.dirPath, dirPath),
      sql`${syncDirectories.id} != ${excludeId}`
    )
  );
  return row;
}

export async function getLatestSyncTime(syncDirectoryId: number) {
  const [row] = await db.select({ endTime: syncDirectoryLogs.endTime })
    .from(syncDirectoryLogs)
    .where(
      and(
        eq(syncDirectoryLogs.syncDirectoryId, syncDirectoryId),
        eq(syncDirectoryLogs.status, 'success')
      )
    )
    .orderBy(desc(syncDirectoryLogs.endTime))
    .limit(1);
  return row?.endTime || null;
} 