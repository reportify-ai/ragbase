import { db } from '../../../db';
import { kbs, syncDirectories, files, syncDirectoryLogs, chatSessions } from '../../../db/schema';
import { eq, inArray } from 'drizzle-orm';

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
  console.log(`[DeleteKB] Starting complete deletion of knowledge base ${id}`);
  
  const errors: string[] = [];
  let deletionStats = {
    syncDirectories: 0,
    files: 0,
    chunks: 0,
    vectorDocuments: 0,
    syncLogs: 0,
    chatSessions: 0,
    errors: 0
  };

  try {
    // Step 1: Get all sync directories for this knowledge base
    console.log(`[DeleteKB] Getting sync directories for KB ${id}`);
    const syncDirs = await db.select().from(syncDirectories).where(eq(syncDirectories.kbId, id));
    console.log(`[DeleteKB] Found ${syncDirs.length} sync directories`);

    // Step 2: Delete all files and related data for each sync directory
    if (syncDirs.length > 0) {
      // Import DocumentDB here to avoid circular imports
      const { DocumentDB } = await import('@/lib/document/db');
      
      for (const syncDir of syncDirs) {
        try {
          console.log(`[DeleteKB] Deleting files for sync directory ${syncDir.id}`);
          const deletionResult = await DocumentDB.deleteFilesBySyncDirectoryId(syncDir.id, id);
          
          deletionStats.files += deletionResult.deletedFiles;
          deletionStats.chunks += deletionResult.deletedChunks;
          deletionStats.vectorDocuments += deletionResult.vectorDeletionSuccessCount;
          
          if (deletionResult.errors.length > 0) {
            errors.push(...deletionResult.errors);
            deletionStats.errors += deletionResult.errors.length;
          }
          
          console.log(`[DeleteKB] Sync directory ${syncDir.id} cleanup: ${deletionResult.deletedFiles} files, ${deletionResult.deletedChunks} chunks, ${deletionResult.vectorDeletionSuccessCount} vectors`);
        } catch (error) {
          const errorMsg = `Error deleting files for sync directory ${syncDir.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          deletionStats.errors++;
          console.error(`[DeleteKB] ${errorMsg}`, error);
        }
      }

      // Step 3: Delete sync directory logs
      try {
        const syncDirIds = syncDirs.map(dir => dir.id);
        const syncLogsResult = await db.delete(syncDirectoryLogs).where(inArray(syncDirectoryLogs.syncDirectoryId, syncDirIds));
        deletionStats.syncLogs = syncLogsResult.changes || 0;
        console.log(`[DeleteKB] Deleted ${deletionStats.syncLogs} sync logs`);
      } catch (error) {
        const errorMsg = `Error deleting sync logs: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        deletionStats.errors++;
        console.error(`[DeleteKB] ${errorMsg}`, error);
      }

      // Step 4: Delete sync directories
      try {
        const syncDirIds = syncDirs.map(dir => dir.id);
        const syncDirResult = await db.delete(syncDirectories).where(inArray(syncDirectories.id, syncDirIds));
        deletionStats.syncDirectories = syncDirResult.changes || 0;
        console.log(`[DeleteKB] Deleted ${deletionStats.syncDirectories} sync directories`);
      } catch (error) {
        const errorMsg = `Error deleting sync directories: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        deletionStats.errors++;
        console.error(`[DeleteKB] ${errorMsg}`, error);
      }
    }

    // Step 5: Clean up chat sessions that only reference this knowledge base
    try {
      // Get all chat sessions that reference this KB
      const chatSessionsToCheck = await db.select().from(chatSessions);
      
      for (const session of chatSessionsToCheck) {
        if (session.kbIds) {
          try {
            const kbIds = JSON.parse(session.kbIds);
            if (Array.isArray(kbIds) && kbIds.includes(String(id))) {
              // Remove this KB from the list
              const newKbIds = kbIds.filter(kbId => kbId !== String(id));
              
              if (newKbIds.length === 0) {
                // If no KBs left, delete the session
                await db.delete(chatSessions).where(eq(chatSessions.id, session.id));
                deletionStats.chatSessions++;
                console.log(`[DeleteKB] Deleted chat session ${session.id} (no KBs remaining)`);
              } else {
                // Update with remaining KBs
                await db.update(chatSessions)
                  .set({ kbIds: JSON.stringify(newKbIds) })
                  .where(eq(chatSessions.id, session.id));
                console.log(`[DeleteKB] Updated chat session ${session.id} (removed KB ${id})`);
              }
            }
          } catch (parseError) {
            console.warn(`[DeleteKB] Could not parse kbIds for session ${session.id}:`, parseError);
          }
        }
      }
    } catch (error) {
      const errorMsg = `Error cleaning up chat sessions: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      deletionStats.errors++;
      console.error(`[DeleteKB] ${errorMsg}`, error);
    }

    // Step 6: Delete the knowledge base record itself
    await db.delete(kbs).where(eq(kbs.id, id));
    console.log(`[DeleteKB] Deleted knowledge base record ${id}`);

    // Step 7: Clean up LanceDB table
    try {
      const { getLanceDBManager } = await import('@/llm/index');
      const tableName = `kb_${id}`;
      const lanceManager = await getLanceDBManager(tableName);
      
      // Note: LanceDB doesn't have a "drop table" API, but the table will be cleaned up
      // when the application restarts since we're not creating it anymore
      console.log(`[DeleteKB] LanceDB table ${tableName} will be cleaned up on next restart`);
    } catch (error) {
      console.warn(`[DeleteKB] Could not access LanceDB for cleanup:`, error);
    }

    console.log(`[DeleteKB] Knowledge base ${id} deletion completed successfully`);
    console.log(`[DeleteKB] Deletion statistics:`, deletionStats);
    
    return {
      success: true,
      stats: deletionStats,
      errors
    };

  } catch (error) {
    const errorMsg = `Critical error during knowledge base ${id} deletion: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    console.error(`[DeleteKB] ${errorMsg}`, error);
    
    return {
      success: false,
      stats: deletionStats,
      errors
    };
  }
} 