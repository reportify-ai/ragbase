import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { connect, Table } from "@lancedb/lancedb";

// Disable Rust logging for LanceDB
process.env.RUST_LOG = 'off';

/**
 * LanceDB Vector Store Manager
 * Provides basic document storage and retrieval functionality
 */
export class LanceDBManager {
  private vectorStore: LanceDB | null = null;
  private rawTable: Table | undefined = undefined;
  private dbConnection: any = null;
  private dbPath: string;
  private tableName: string;
  private embeddings: Embeddings;

  /**
   * Constructor
   * @param dbPath LanceDB database path
   * @param tableName Table name
   * @param embeddings Embedding model
   */
  constructor(dbPath: string, tableName: string, embeddings: Embeddings) {
    this.dbPath = dbPath;
    this.tableName = tableName;
    this.embeddings = embeddings;
  }

  /**
   * Initialize vector store and raw table connection
   * @param documents Initial documents (optional)
   */
  async initialize(documents?: Document[]): Promise<void> {
    try {
      // Initialize database connection
      if (!this.dbConnection) {
        this.dbConnection = await connect(this.dbPath);
      }

      if (documents && documents.length > 0) {
        // There are documents, create or overwrite table
        console.log(`Initializing table ${this.tableName} with ${documents.length} documents`);
        
        this.vectorStore = await LanceDB.fromDocuments(
          documents,
          this.embeddings,
          {
            uri: this.dbPath,
            tableName: this.tableName
          }
        );
        
        // Also initialize raw table connection
        this.rawTable = await this.dbConnection.openTable(this.tableName);
      } else {
        // Try to connect to existing table
        console.log(`Attempting to connect to existing table ${this.tableName}`);
        this.rawTable = await this.dbConnection.openTable(this.tableName);
        
        this.vectorStore = new LanceDB(this.embeddings, {
          table: this.rawTable,
          textKey: "text"
        });
        console.log(`Successfully connected to existing table ${this.tableName}`);
      }
    } catch (error) {
      console.info(`Error initializing vector store: ${error}, waiting for next initialization with documents...`);
      // throw new Error(`Failed to initialize vector store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add documents
   * @param documents Documents to add
   */
  async addDocuments(documents: Document[]): Promise<void> {
    if (!this.vectorStore) {
      console.log(`Vector store not initialized, initializing with documents...`);
      try {
        await this.initialize(documents);
        return;
      } catch (error) {
        console.error(`Failed to initialize vector store with documents: ${error}`);
        throw new Error(`Failed to initialize vector store: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log(`Adding ${documents.length} documents to table ${this.tableName}`);
    try {
      await this.vectorStore.addDocuments(documents);
      
      // Refresh raw table connection after adding documents to ensure consistency
      if (this.dbConnection && this.rawTable) {
        this.rawTable = await this.dbConnection.openTable(this.tableName);
      }
      
      console.log(`Added ${documents.length} documents to table ${this.tableName}`);
    } catch (error) {
      console.error(`Error adding documents to vector store: ${error}`);
      throw new Error(`Failed to add documents to vector store: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Similarity search
   * @param query Query text
   * @param k Number of results to return
   * @returns Array of similar documents
   */
  async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    if (!this.vectorStore) {
      console.log(`Vector store not initialized, attempting to connect to existing table...`);
      try {
        await this.initialize();
      } catch (error) {
        throw new Error(`Cannot perform search: Vector store not initialized and failed to connect to existing table. ${error instanceof Error ? error.message : ''}`);
      }
    }
    
    return await this.vectorStore!.similaritySearch(query, k);
  }

  /**
   * Similarity search with scores
   * @param query Query text
   * @param k Number of results to return
   * @returns Array of [document, score] pairs sorted by score in descending order
   */
  async similaritySearchWithScores(query: string, k: number = 4): Promise<[Document, number][]> {
    if (!this.vectorStore) {
      console.log(`Vector store not initialized, attempting to connect to existing table...`);
      try {
        await this.initialize();
      } catch (error) {
        throw new Error(`Cannot perform search: Vector store not initialized and failed to connect to existing table. ${error instanceof Error ? error.message : ''}`);
      }
    }
    
    const results = await this.vectorStore!.similaritySearchWithScore(query, k);
    
    // Sort by similarity score from high to low (lower score means more similar)
    return results.sort((a, b) => a[1] - b[1]);
  }

  /**
   * Delete documents from vector database by file ID
   * Uses LanceDB's native delete method through cached raw table connection
   * @param fileId File ID to delete
   * @returns True if operation was successful
   */
  async deleteDocumentsByFileId(fileId: number): Promise<boolean> {
    try {
      console.log(`[LanceDBManager] Starting vector deletion for fileId: ${fileId} in table: ${this.tableName}`);
      
      // Ensure we have a raw table connection
      const table = await this.ensureRawTable();      
      
      // Check if table has data
      const count = await table.countRows();
      console.log(`[LanceDBManager] Total documents in table before deletion: ${count}`);
      
      if (count === 0) {
        console.log(`[LanceDBManager] Table is empty, no deletion needed for fileId: ${fileId}`);
        return true;
      }
      

      // Try to find documents with this fileId before deletion for verification
      let documentsWithFileId = 0;
      try {
        // Use backticks for column names (correct LanceDB syntax)
        const queryResults = await table.query().where(`\`fileId\` = ${fileId}`).limit(1000).toArray();
        documentsWithFileId = queryResults.length;
        console.log(`[LanceDBManager] Found ${documentsWithFileId} documents with fileId ${fileId} (using backtick syntax)`);
      } catch (queryError) {
        console.log(`[LanceDBManager] Could not query for documents with fileId ${fileId}:`, queryError instanceof Error ? queryError.message : String(queryError));
      }
      
      
      // Delete documents with the specified fileId (use correct backtick syntax)
      console.log(`[LanceDBManager] Attempting to delete documents with fileId = ${fileId}`);
      
      await table.delete(`\`fileId\` = ${fileId}`);
      
      const finalCount = await table.countRows();
      const totalDeleted = count - finalCount;
      console.log(`[LanceDBManager] Deleted ${totalDeleted} documents for fileId ${fileId}, ${finalCount} documents remaining`);
      
      if (totalDeleted > 0) {
        console.log(`[LanceDBManager] ✅ Successfully deleted ${totalDeleted} documents for fileId: ${fileId}`);
      } else if (documentsWithFileId > 0) {
        console.warn(`[LanceDBManager] ⚠️ Warning: Expected to delete ${documentsWithFileId} documents for fileId ${fileId}, but no documents were actually deleted`);
      } else {
        console.log(`[LanceDBManager] ℹ️ No documents found with fileId: ${fileId}. This is normal if:`);
        console.log(`[LanceDBManager]    - File was never successfully vectorized`);
        console.log(`[LanceDBManager]    - File was already deleted from vectors`);
        console.log(`[LanceDBManager]    - File embedding process failed`);
        console.log(`[LanceDBManager] 🎯 Deletion goal achieved: fileId ${fileId} does not exist in vector database`);
      }
      
      // Final verification: try to query for remaining documents with this fileId
      try {
        const remainingDocs = await table.query().where(`\`fileId\` = ${fileId}`).limit(1).toArray();
        if (remainingDocs.length > 0) {
          console.warn(`[LanceDBManager] Warning: Found ${remainingDocs.length} documents still remaining with fileId ${fileId} after deletion`);
        } else {
          console.log(`[LanceDBManager] ✅ Verification passed: No documents with fileId ${fileId} found after deletion`);
        }
      } catch (verifyError) {
        console.log(`[LanceDBManager] Could not verify deletion for fileId ${fileId}:`, verifyError instanceof Error ? verifyError.message : String(verifyError));
      }
      
      return true;
    } catch (error) {
      console.error(`[LanceDBManager] Failed to delete documents from vector database for fileId ${fileId}:`, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Ensure we have a raw table connection, create if not exists
   * @returns LanceDB table object
   */
  private async ensureRawTable(): Promise<Table> {
    if (!this.rawTable || !this.dbConnection) {
      console.log(`[LanceDBManager] Initializing raw table connection for: ${this.tableName}`);
      if (!this.dbConnection) {
        this.dbConnection = await connect(this.dbPath);
      }
      this.rawTable = await this.dbConnection.openTable(this.tableName);
    }
    return this.rawTable!;
  }

  /**
   * Delete documents from vector database by multiple file IDs (batch operation)
   * More efficient than calling deleteDocumentsByFileId multiple times
   * @param fileIds Array of file IDs to delete
   * @returns Object with deletion statistics
   */
  async deleteDocumentsByFileIds(fileIds: number[]): Promise<{
    totalDeleted: number;
    successCount: number;
    failureCount: number;
    errors: string[];
  }> {
    const result = {
      totalDeleted: 0,
      successCount: 0,
      failureCount: 0,
      errors: [] as string[]
    };

    if (fileIds.length === 0) {
      console.log(`[LanceDBManager] No fileIds provided for batch deletion`);
      return result;
    }

    try {
      console.log(`[LanceDBManager] Starting batch vector deletion for ${fileIds.length} fileIds in table: ${this.tableName}`);
      
      const table = await this.ensureRawTable();
      const countBefore = await table.countRows();
      console.log(`[LanceDBManager] Total documents in table before batch deletion: ${countBefore}`);

      // Check how many documents we expect to delete (use individual queries for now)
      let expectedDeletions = 0;
      for (const fileId of fileIds) {
        try {
          const queryResults = await table.query().where(`\`fileId\` = ${fileId}`).limit(1000).toArray();
          console.log(`[LanceDBManager] FileId ${fileId}: Found ${queryResults.length} documents to delete`);
          if (queryResults.length > 0) {
            console.log(`[LanceDBManager] FileId ${fileId}: document metadata:`, JSON.stringify(queryResults[0].metadata, null, 2));
          }
          expectedDeletions += queryResults.length;
        } catch (queryError) {
          console.log(`[LanceDBManager] Could not query documents for fileId ${fileId}:`, queryError instanceof Error ? queryError.message : String(queryError));
        }
      }
      console.log(`[LanceDBManager] Total expected deletions: ${expectedDeletions} documents for ${fileIds.length} files`);

      // Perform individual deletions for each fileId
      console.log(`[LanceDBManager] Executing individual deletions for ${fileIds.length} fileIds`);
      for (const fileId of fileIds) {
        try {
          console.log(`[LanceDBManager] Attempting to delete documents for fileId ${fileId} using query: \`fileId\` = ${fileId}`);
          await table.delete(`\`fileId\` = ${fileId}`);
          console.log(`[LanceDBManager] ✅ Delete command executed for fileId ${fileId}`);
        } catch (deleteError) {
          console.error(`[LanceDBManager] ❌ Failed to delete documents for fileId ${fileId}:`, deleteError instanceof Error ? deleteError.message : String(deleteError));
        }
      }

      const countAfter = await table.countRows();
      const totalDeleted = countBefore - countAfter;
      result.totalDeleted = totalDeleted;

      console.log(`[LanceDBManager] Batch deletion completed: ${totalDeleted} documents deleted, ${countAfter} documents remaining`);

      if (totalDeleted > 0) {
        result.successCount = fileIds.length; // Assume all succeeded if any were deleted
        console.log(`[LanceDBManager] ✅ Successfully deleted ${totalDeleted} documents for ${fileIds.length} files in batch`);
      } else if (expectedDeletions > 0) {
        result.failureCount = fileIds.length;
        result.errors.push(`Expected to delete ${expectedDeletions} documents but none were deleted`);
        console.warn(`[LanceDBManager] ⚠️ Warning: Expected to delete ${expectedDeletions} documents but none were actually deleted`);
      } else {
        console.log(`[LanceDBManager] ℹ️ No documents found for ${fileIds.length} fileIds. All files already removed from vector database.`);
        result.successCount = fileIds.length; // Consider it success if target state achieved
      }

      // Final verification - check if any documents still exist for these fileIds
      let remainingCount = 0;
      try {
        for (const fileId of fileIds) {
          const remainingDocs = await table.query().where(`\`fileId\` = ${fileId}`).limit(1).toArray();
          remainingCount += remainingDocs.length;
        }
        if (remainingCount > 0) {
          console.warn(`[LanceDBManager] Warning: Found ${remainingCount} documents still remaining after batch deletion`);
        } else {
          console.log(`[LanceDBManager] ✅ Verification passed: No documents found for batch fileIds after deletion`);
        }
      } catch (verifyError) {
        console.log(`[LanceDBManager] Could not verify batch deletion:`, verifyError instanceof Error ? verifyError.message : String(verifyError));
      }

      return result;
    } catch (error) {
      const errorMsg = `Failed to batch delete documents from vector database: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      result.failureCount = fileIds.length;
      console.error(`[LanceDBManager] ${errorMsg}`);
      return result;
    }
  }

  /**
   * Get raw LanceDB table object (for advanced operations)
   * @returns LanceDB table object
   */
  async getRawTable(): Promise<Table> {
    console.log(`[LanceDBManager] Accessing raw table: ${this.tableName}`);
    return await this.ensureRawTable();
  }
} 