import { NextRequest, NextResponse } from 'next/server';
import { deleteFile } from '../db';
import { DocumentDB } from '@/lib/document/db';
import { getLanceDBManager } from '@/llm';

// Explicitly specify Node.js runtime
export const runtime = 'nodejs';

/**
 * Complete file deletion API
 * Deletes a file and all associated data:
 * 1. Document chunks from database
 * 2. Embeddings from database
 * 3. Vector data from LanceDB using delete method
 * 4. File record from database
 */
export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    
    if (!id) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    // Step 1: Get file information to determine which knowledge base it belongs to
    const fileInfo = await DocumentDB.getFileById(id);
    if (!fileInfo) {
      return NextResponse.json(
        { error: `File with ID ${id} not found` },
        { status: 404 }
      );
    }

    // Step 2: Get directory info to determine knowledge base ID
    const dirInfo = await DocumentDB.getSyncDirectoryById(fileInfo.sync_directory_id);
    if (!dirInfo) {
      console.warn(`Sync directory with ID ${fileInfo.sync_directory_id} not found, proceeding with deletion anyway`);
    }

    // Step 3: Delete document chunks and embeddings from database
    await DocumentDB.deleteFileData(id);
    console.log(`Deleted chunks and embeddings for file ID ${id}`);

    // Step 4: Delete from vector database if we have KB info
    if (dirInfo?.kbId) {
      try {
        // Get LanceDB manager for this knowledge base
        const tableName = `kb_${dirInfo.kbId}`;
        const lanceManager = await getLanceDBManager(tableName);
        
        // Use the deleteDocumentsByFileId method to delete vectors
        const success = await lanceManager.deleteDocumentsByFileId(id);
        if (success) {
          console.log(`Successfully deleted vector data for file ID ${id} from LanceDB table ${tableName}`);
        } else {
          console.warn(`Failed to delete vector data for file ID ${id} from LanceDB table ${tableName}`);
        }
      } catch (error) {
        console.error(`Error deleting from vector database for file ${id}:`, error);
      }
    }

    // Step 5: Delete the file record from the database
    await deleteFile(id);
    console.log(`Deleted file record for ID ${id}`);

    return NextResponse.json({
      success: true,
      message: "File and all associated data deleted successfully"
    });
  } catch (error) {
    console.error("File deletion failed:", error);
    return NextResponse.json(
      { error: `File deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 