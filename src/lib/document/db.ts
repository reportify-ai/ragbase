import { db } from '../../db';
import { files, documentChunks, embeddings, syncDirectories } from '../../db/schema';
import { eq, and, inArray, count, or } from 'drizzle-orm';
import { Document } from '@langchain/core/documents';
import { FileStatus } from '../../db/schema';

export interface ChunkData {
  file_id: number;
  chunk_index: number;
  content: string;
  metadata: Record<string, any>;
}

export interface EmbeddingData {
  chunk_id: number;
  embedding_model_id: number;
  vector: number[];
}

export class DocumentDB {
  // Update file status
  static async updateFileStatus(
    fileId: number,
    status: FileStatus,
    errorMessage?: string
  ): Promise<void> {
    await db
      .update(files)
      .set({
        status,
        last_processed: new Date().toISOString(),
        error_message: errorMessage,
      })
      .where(eq(files.id, fileId));
  }

  // Update file metadata
  static async updateFileMetadata(
    fileId: number,
    metadata: {
      mime_type?: string;
      content_length?: number;
    }
  ): Promise<void> {
    await db
      .update(files)
      .set(metadata)
      .where(eq(files.id, fileId));
  }

  // Get file by ID
  static async getFileById(fileId: number) {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId));
    
    return file;
  }

  // Get sync directory by ID
  static async getSyncDirectoryById(dirId: number) {
    const [directory] = await db
      .select()
      .from(syncDirectories)
      .where(eq(syncDirectories.id, dirId));
    
    return directory;
  }

  // Batch insert document chunks
  static async insertChunks(chunks: ChunkData[]): Promise<number[]> {
    if (chunks.length === 0) return [];

    const chunkData = chunks.map(chunk => ({
      file_id: chunk.file_id,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      metadata: JSON.stringify(chunk.metadata),
    }));

    const result = await db.insert(documentChunks).values(chunkData);
    
    // Due to SQLite limitations, we need to manually get the inserted IDs
    const insertedChunks = await db
      .select({ id: documentChunks.id })
      .from(documentChunks)
      .where(eq(documentChunks.file_id, chunks[0].file_id))
      .orderBy(documentChunks.id)
      .limit(chunks.length);

    return insertedChunks.map(chunk => chunk.id);
  }

  // Insert a single document chunk
  static async insertChunk(chunk: ChunkData): Promise<number> {
    const result = await db.insert(documentChunks).values({
      file_id: chunk.file_id,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      metadata: JSON.stringify(chunk.metadata),
    });

    // Get the inserted ID
    const insertedChunk = await db
      .select({ id: documentChunks.id })
      .from(documentChunks)
      .where(eq(documentChunks.file_id, chunk.file_id))
      .orderBy(documentChunks.id)
      .limit(1);

    return insertedChunk[0]?.id || 0;
  }

  // Batch insert embedding vectors
  static async insertEmbeddings(embeddingsData: EmbeddingData[]): Promise<void> {
    if (embeddingsData.length === 0) return;

    const vectorData = embeddingsData.map(emb => ({
      chunk_id: emb.chunk_id,
      embedding_model_id: emb.embedding_model_id,
      vector: JSON.stringify(emb.vector),
    }));

    await db.insert(embeddings).values(vectorData);
  }

  // Get all chunks for a file
  static async getFileChunks(fileId: number): Promise<Document[]> {
    const chunks = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.file_id, fileId))
      .orderBy(documentChunks.chunk_index);

    // Get file information to add more metadata
    const [fileInfo] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId));

    if (!chunks.length) {
      return [];
    }

    return chunks.map(chunk => {
      // Parse original metadata
      const rawMetadata = JSON.parse(chunk.metadata || '{}') as Record<string, any>;
      
      // Create standardized metadata object
      const metadata: Record<string, any> = {
        chunkId: chunk.id,
        chunkIndex: chunk.chunk_index,
        fileId: chunk.file_id,
        // Add standard fields to ensure all documents have these fields
        fileName: fileInfo?.name || '',
        filePath: fileInfo?.path || '',
        fileSize: fileInfo?.size || 0,
        mimeType: fileInfo?.mime_type || '',
        pageNumber: rawMetadata.pageNumber || 1,
        totalPages: rawMetadata.totalPages || 1,
        originalFile: fileInfo?.name || '',
        processedAt: rawMetadata.processedAt || new Date().toISOString(),
      };

      return new Document({
        pageContent: chunk.content,
        metadata: metadata,
      });
    });
  }

  // Get all embeddings for a file
  static async getFileEmbeddings(fileId: number, embeddingModelId?: number): Promise<EmbeddingData[]> {
    const query = db
      .select({
        chunk_id: embeddings.chunk_id,
        embedding_model_id: embeddings.embedding_model_id,
        vector: embeddings.vector,
      })
      .from(embeddings)
      .innerJoin(documentChunks, eq(embeddings.chunk_id, documentChunks.id))
      .where(
        embeddingModelId 
          ? and(eq(documentChunks.file_id, fileId), eq(embeddings.embedding_model_id, embeddingModelId))
          : eq(documentChunks.file_id, fileId)
      );

    const results = await query;
    
    return results.map(row => ({
      chunk_id: row.chunk_id,
      embedding_model_id: row.embedding_model_id,
      vector: JSON.parse(row.vector),
    }));
  }

  // Delete all chunks and embeddings for a file
  static async deleteFileData(fileId: number): Promise<void> {
    // First delete embedding vectors
    const chunks = await db
      .select({ id: documentChunks.id })
      .from(documentChunks)
      .where(eq(documentChunks.file_id, fileId));

    if (chunks.length > 0) {
      const chunkIds = chunks.map(c => c.id);
      await db
        .delete(embeddings)
        .where(inArray(embeddings.chunk_id, chunkIds));
    }

    // Delete chunk data
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.file_id, fileId));
  }

  // Get pending files
  static async getPendingFiles(limit: number = 10): Promise<Array<{
    id: number;
    name: string;
    path: string;
    size: number;
    status: number;
  }>> {
    return await db
      .select({
        id: files.id,
        name: files.name,
        path: files.path,
        size: files.size,
        status: files.status,
      })
      .from(files)
      .where(eq(files.status, FileStatus.PENDING))
      .limit(limit);
  }

  // Get failed files
  static async getFailedFiles(limit: number = 10): Promise<Array<{
    id: number;
    name: string;
    path: string;
    error_message: string | null;
  }>> {
    return await db
      .select({
        id: files.id,
        name: files.name,
        path: files.path,
        error_message: files.error_message,
      })
      .from(files)
      .where(or(
        eq(files.status, FileStatus.FAILED),
        eq(files.status, FileStatus.EMBEDDING_FAILED)
      ))
      .limit(limit);
  }

  // Get file processing statistics
  static async getFileStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const stats = await db
      .select({
        status: files.status,
        count: count(files.id),
      })
      .from(files)
      .groupBy(files.status);

    const result = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    stats.forEach(stat => {
      const count = Number(stat.count);
      result.total += count;
      
      switch (stat.status) {
        case FileStatus.PENDING:
          result.pending += count;
          break;
        case FileStatus.PARSING:
        case FileStatus.CHUNKING:
        case FileStatus.EMBEDDING:
          result.processing += count;
          break;
        case FileStatus.COMPLETED:
          result.completed += count;
          break;
        case FileStatus.FAILED:
        case FileStatus.EMBEDDING_FAILED:
          result.failed += count;
          break;
      }
    });

    return result;
  }

  // Get chunk statistics
  static async getChunkStats(): Promise<{
    totalChunks: number;
    totalEmbeddings: number;
    averageChunksPerFile: number;
  }> {
    const [chunksResult] = await db
      .select({ count: count() })
      .from(documentChunks);
    
    const [embeddingsResult] = await db
      .select({ count: count() })
      .from(embeddings);
    
    const [filesResult] = await db
      .select({ count: count() })
      .from(files)
      .where(eq(files.status, FileStatus.COMPLETED));
    
    const totalChunks = Number(chunksResult?.count || 0);
    const totalEmbeddings = Number(embeddingsResult?.count || 0);
    const completedFiles = Number(filesResult?.count || 0);
    
    return {
      totalChunks,
      totalEmbeddings,
      averageChunksPerFile: completedFiles > 0 ? totalChunks / completedFiles : 0,
    };
  }
} 