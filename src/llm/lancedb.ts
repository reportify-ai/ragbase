import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { connect, Table } from "@lancedb/lancedb";

/**
 * LanceDB Vector Store Manager
 * Provides basic document storage and retrieval functionality
 */
export class LanceDBManager {
  private vectorStore: LanceDB | null = null;
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
   * Initialize vector store
   * @param documents Initial documents (optional)
   */
  async initialize(documents?: Document[]): Promise<void> {
    try {
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
      } else {
        // Try to connect to existing table
        console.log(`Attempting to connect to existing table ${this.tableName}`);
        const db = await connect(this.dbPath);
        const table = await db.openTable(this.tableName);
        
        this.vectorStore = new LanceDB(this.embeddings, {
          table,
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
   * Uses LanceDB's native delete method
   * @param fileId File ID to delete
   * @returns True if operation was successful
   */
  async deleteDocumentsByFileId(fileId: number): Promise<boolean> {
    try {
      // Get raw table object
      const table = await this.getRawTable();
      
      // Use LanceDB's delete method to delete the vector corresponding to the file
        // According to the error message, we know the field name is "fileId" (case-sensitive)
      // Use double quotes to wrap the field name to ensure correct recognition
      await table.delete(`"fileId" = ${fileId}`);
      
      console.log(`Successfully deleted documents with fileId ${fileId} from table ${this.tableName}`);
      
      return true;
    } catch (error) {
      console.error(`Failed to delete documents from vector database: ${error}`);
      
      return false;
    }
  }

  /**
   * Get raw LanceDB table object (for advanced operations)
   * @returns LanceDB table object
   */
  async getRawTable(): Promise<Table> {
    console.log(`Accessing raw table: ${this.tableName}`);
    const db = await connect(this.dbPath);
    return await db.openTable(this.tableName);
  }
} 