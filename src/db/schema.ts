import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm/sql';
import { drizzle } from 'drizzle-orm/better-sqlite3';

export const embeddingModels = sqliteTable('embedding_models', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  apiUrl: text('apiUrl').notNull(),
  dimension: integer('dimension').notNull(),
  description: text('description'),
  provider: text('provider').notNull().default('ollama'),
  is_default: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const models = sqliteTable('models', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  apiUrl: text('apiUrl').notNull(),
  apiKey: text('apiKey'),
  contextSize: integer('contextSize').notNull(),
  temperature: real('temperature').notNull(),
  topP: real('topP').notNull(),
  maxTokens: integer('maxTokens').notNull(),
  provider: text('provider').notNull().default('ollama'),
  is_default: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const kbs = sqliteTable('kbs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const syncDirectories = sqliteTable('sync_directories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kbId: integer('kb_id').notNull(),
  dirPath: text('dir_path').notNull(),
  syncType: text('sync_type').notNull(),
  recursive: integer('recursive', { mode: 'boolean' }).notNull().default(false),
  ignoreHidden: integer('ignore_hidden', { mode: 'boolean' }).notNull().default(true),
  ignoreLarge: integer('ignore_large', { mode: 'boolean' }).notNull().default(true),
  fileTypes: text('file_types').notNull(),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const files = sqliteTable('files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  path: text('path').notNull(),
  size: integer('size').notNull(),
  hash: text('hash').notNull(),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  status: integer('status').notNull().default(0),
  sync_directory_id: integer('sync_directory_id').notNull(),
  kb_id: integer('kb_id').notNull(),
  mime_type: text('mime_type'),
  content_length: integer('content_length'),
  last_processed: text('last_processed'),
  error_message: text('error_message'),
});

export const syncDirectoryLogs = sqliteTable('sync_directory_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  syncDirectoryId: integer('sync_directory_id').notNull(),
  kbId: integer('kb_id'),
  startTime: text('start_time').notNull(),
  endTime: text('end_time'),
  status: text('status').notNull(), // running, success, failed, canceled
  totalFiles: integer('total_files').notNull().default(0),
  syncedFiles: integer('synced_files').notNull().default(0),
  failedFiles: integer('failed_files').notNull().default(0),
  message: text('message'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const documentChunks = sqliteTable('document_chunks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  file_id: integer('file_id').notNull(),
  chunk_index: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata'), // Store metadata in JSON format
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const embeddings = sqliteTable('embeddings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chunk_id: integer('chunk_id').notNull(),
  embedding_model_id: integer('embedding_model_id').notNull(),
  vector: text('vector').notNull(), // Store vector data in JSON format
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const chatSessions = sqliteTable('chat_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull().unique(),
  title: text('title'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  messageCount: integer('message_count').notNull().default(0),
  kbIds: text('kb_ids'), // JSON format
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  messageIndex: integer('message_index').notNull(),
  relatedDocuments: text('related_documents'), // JSON format
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export enum FileStatus {
  PENDING = 0,      // Pending
  PARSING = 1,      // Parsing
  PARSED = 2,       // Parsed
  CHUNKING = 3,     // Chunking
  CHUNKED = 4,      // Chunked
  EMBEDDING = 5,    // Embedding
  COMPLETED = 6,    // Completed
  FAILED = -1,      // Failed
  EMBEDDING_FAILED = -2  // Embedding Failed
}

export async function initData(db: any) {
  try {
    // Initialize default knowledge base
    const existingKbs = await db.select().from(kbs);
    if (!existingKbs || existingKbs.length === 0) {
      await db.insert(kbs).values({ name: 'Default', description: 'Default Knowledge Base' });
      console.log('Default knowledge base created');
    }

    // Initialize default LLM model
    const existingModels = await db.select().from(models);
    if (!existingModels || existingModels.length === 0) {
      await db.insert(models).values({
        name: 'qwen3:8b',
        apiUrl: 'http://localhost:11434',
        contextSize: 8196,
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 4096,
        provider: 'Ollama',
        is_default: true
      });
      console.log('Default LLM model created');
    }

    // Initialize default embedding model
    const existingEmbeddings = await db.select().from(embeddingModels);
    if (!existingEmbeddings || existingEmbeddings.length === 0) {
      await db.insert(embeddingModels).values({
        name: 'dengcao/Qwen3-Embedding-0.6B:F16',
        apiUrl: 'http://localhost:11434',
        dimension: 768,
        provider: 'Ollama',
        description: 'Qwen3Embedding',
        is_default: true
      });
      console.log('Default embedding model created');
    }
  } catch (error) {
    console.error('Failed to initialize default data:', error);
  }
} 