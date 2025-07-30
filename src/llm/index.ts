import path from 'path';
import { OllamaEmbeddings } from "@langchain/ollama";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Embeddings } from "@langchain/core/embeddings";
import { LanceDBManager } from './lancedb'
import * as embeddingsDb from '../app/api/embeddings/db';

/**
 * Embedding provider types
 */
export enum EmbeddingProvider {
  OLLAMA = 'ollama',
  OPENAI = 'openai'
}

// Get data directory
const DATA_DIR = process.env.DATA_DIR || './data';

/**
 * Database embedding model type
 */
export type DbEmbeddingModel = {
  id: number;
  name: string;
  apiUrl: string;
  dimension: number;
  provider: string;
  description?: string | null;
  is_default?: boolean | null;
  created_at?: string | null;
};

/**
 * Embedding configuration interface
 */
export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  dimensions?: number;
}

/**
 * LanceDB configuration interface
 */
export interface LanceDBConfig {
  dbPath: string;
  tableName: string;
}

/**
 * Create an Embedding model instance
 * @param dbModel Database embedding model
 * @returns Embedding model instance
 */
export function createEmbeddingModel(dbModel: DbEmbeddingModel): Embeddings {
  // Determine provider type
  const provider = (dbModel.provider || '').toLowerCase();
  
  if (provider === 'openai' || dbModel.apiUrl.includes('openai')) {
    return new OpenAIEmbeddings({
      modelName: dbModel.name,
      openAIApiKey: process.env.OPENAI_API_KEY
    });
  } else {
    // Default to Ollama
    return new OllamaEmbeddings({
      model: dbModel.name,
      baseUrl: dbModel.apiUrl || "http://localhost:11434"
    });
  }
}

/**
 * Get default embedding model from database
 * @returns Embedding model
 * @throws Error if no embedding model is found
 */
export async function getDefaultEmbeddingModel(): Promise<DbEmbeddingModel> {
  try {
    const dbModel = await embeddingsDb.getDefaultEmbeddingModel();

    if (!dbModel) {
      throw new Error(`Default embedding model not found`);
    }
    
    return dbModel;
  } catch (error) {
    console.error('Failed to get default embedding model:', error);
    throw new Error(`Failed to get default embedding model: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create LanceDBManager instance
 * @param tableName Table name
 * @param dbPath Database path (optional, defaults to DATA_DIR/lancedb)
 * @returns LanceDBManager instance
 * @throws Error if no embedding model is found
 */
export async function createLanceDBManager(
  tableName: string,
  dbPath: string = path.join(DATA_DIR, 'lancedb')
): Promise<LanceDBManager> {
  try {
    // Get default embedding model
    const dbModel = await getDefaultEmbeddingModel();
    
    // Create Embedding model
    const embeddings = createEmbeddingModel(dbModel);
    
    // Create LanceDBManager
    const lanceManager = new LanceDBManager(dbPath, tableName, embeddings);
    
    // Initialize database
    await lanceManager.initialize();
    
    return lanceManager;
  } catch (error) {
    console.error('Failed to create LanceDBManager:', error);
    throw new Error(`Failed to create LanceDBManager: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get LanceDBManager instance for specified table name
 * If the table doesn't exist, a new one will be created
 * @param tableName Table name
 * @returns LanceDBManager instance
 */
export async function getLanceDBManager(
  tableName: string,
): Promise<LanceDBManager> {
  return createLanceDBManager(tableName);
}

export { 
  LanceDBManager,
}; 