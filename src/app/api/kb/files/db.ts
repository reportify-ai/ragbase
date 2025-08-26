import { db } from '../../../../db';
import { files, FileStatus } from '../../../../db/schema';
import { eq, and, inArray, count, desc, or } from 'drizzle-orm';

export async function getFiles(syncDirectoryIds?: number[], kbId?: number, limit?: number, offset?: number) {
  // Build base query
  let baseQuery;
  
  if (kbId) {
    baseQuery = db.select().from(files).where(eq(files.kb_id, kbId));
  } else if (syncDirectoryIds && syncDirectoryIds.length > 0) {
    baseQuery = db.select().from(files).where(inArray(files.sync_directory_id, syncDirectoryIds));
  } else {
    baseQuery = db.select().from(files);
  }
  
  // Apply sorting
  const orderedQuery = baseQuery.orderBy(desc(files.created_at));
  
  // Apply pagination
  const paginatedQuery = typeof limit === 'number'
    ? (typeof offset === 'number' 
        ? orderedQuery.limit(limit).offset(offset)
        : orderedQuery.limit(limit))
    : (typeof offset === 'number'
        ? orderedQuery.offset(offset)
        : orderedQuery);
  
  return paginatedQuery;
}

export async function getFilesCount(syncDirectoryIds?: number[], kbId?: number) {
  let query;
  
  if (kbId) {
    query = db.select({ count: count().as('count') })
      .from(files)
      .where(eq(files.kb_id, kbId));
  } else if (syncDirectoryIds && syncDirectoryIds.length > 0) {
    query = db.select({ count: count().as('count') })
      .from(files)
      .where(inArray(files.sync_directory_id, syncDirectoryIds));
  } else {
    query = db.select({ count: count().as('count') }).from(files);
  }
    
  const result = await query;
  return Number(result[0]?.count || 0);
}

export async function createFile(data: Omit<typeof files.$inferInsert, 'id'>) {
  const [row] = await db.insert(files).values(data).returning();
  return row;
}

export async function updateFile(id: number, data: Partial<typeof files.$inferInsert>) {
  const [row] = await db.update(files).set(data).where(eq(files.id, id)).returning();
  return row;
}

export async function deleteFile(id: number) {
  await db.delete(files).where(eq(files.id, id));
}

export async function fileExists(path: string, syncDirectoryId: number) {
  const result = await db.select().from(files).where(and(eq(files.path, path), eq(files.sync_directory_id, syncDirectoryId))).limit(1);
  return result.length > 0;
}

// Get failed files list
export async function getFailedFiles(syncDirectoryIds?: number[], kbId?: number, limit?: number, offset?: number) {
  try {
    // Build conditions
    let conditions;
    
    const failedStatus = or(
      eq(files.status, FileStatus.FAILED),
      eq(files.status, FileStatus.EMBEDDING_FAILED)
    );
    
    if (kbId) {
      conditions = and(failedStatus, eq(files.kb_id, kbId));
    } else if (syncDirectoryIds && syncDirectoryIds.length > 0) {
      conditions = and(failedStatus, inArray(files.sync_directory_id, syncDirectoryIds));
    } else {
      conditions = failedStatus;
    }
    
    // Build base query
    const baseQuery = db.select().from(files).where(conditions);
    
    // Apply sorting
    const orderedQuery = baseQuery.orderBy(desc(files.created_at));
    
    // Apply pagination
    const paginatedQuery = typeof limit === 'number'
      ? (typeof offset === 'number' 
          ? orderedQuery.limit(limit).offset(offset)
          : orderedQuery.limit(limit))
      : (typeof offset === 'number'
          ? orderedQuery.offset(offset)
          : orderedQuery);
    
    return paginatedQuery;
  } catch (error) {
    console.error('Error getting failed files list:', error);
    return [];
  }
}

// Get failed files count
export async function getFailedFilesCount(syncDirectoryIds?: number[], kbId?: number) {
  try {
    const conditions = [or(eq(files.status, -1), eq(files.status, FileStatus.EMBEDDING_FAILED))];
    
    if (kbId) {
      conditions.push(eq(files.kb_id, kbId));
    } else if (syncDirectoryIds && syncDirectoryIds.length > 0) {
      conditions.push(inArray(files.sync_directory_id, syncDirectoryIds));
    }
    
    const result = await db.select({ count: count().as('count') })
      .from(files)
      .where(and(...conditions));
      
    return Number(result[0]?.count || 0);
  } catch (error) {
    console.error('Error getting failed files count:', error);
    return 0;
  }
}

// Reset file status to pending, clear error message
export async function resetFileForRetry(fileId: number) {
  const [row] = await db.update(files)
    .set({
      status: 0, // FileStatus.PENDING = 0
      error_message: null,
      last_processed: null
    })
    .where(eq(files.id, fileId))
    .returning();
  return row;
}

// Batch reset file status
export async function resetFilesForRetry(fileIds: number[]) {
  if (fileIds.length === 0) return [];
  
  const [rows] = await db.update(files)
    .set({
      status: 0, // FileStatus.PENDING = 0
      error_message: null,
      last_processed: null
    })
    .where(inArray(files.id, fileIds))
    .returning();
  return rows;
} 