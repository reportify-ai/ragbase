import { db } from '@/db';
import { chatSessions, chatMessages } from '@/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { ChatMessage as BaseChatMessage } from './service';

// Extended chat message interface with UI-specific fields
export interface ChatMessage extends BaseChatMessage {
  relatedDocuments?: any[];
}

export interface ChatSession {
  id: number;
  sessionId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  kbIds?: number[];
  isArchived: boolean;
}

export interface StoredChatMessage {
  id: number;
  sessionId: string;
  role: string;
  content: string;
  messageIndex: number;
  relatedDocuments?: any[];
  createdAt: string;
}

/**
 * Create a new chat session
 */
export async function createChatSession(sessionId: string, kbIds?: number[], title?: string): Promise<ChatSession> {
  const result = await db.insert(chatSessions).values({
    sessionId,
    title: title || undefined,
    kbIds: kbIds ? JSON.stringify(kbIds) : null,
  }).returning();
  
  const session = result[0];
  return {
    id: session.id,
    sessionId: session.sessionId,
    title: session.title || undefined,
    createdAt: session.createdAt!,
    updatedAt: session.updatedAt!,
    messageCount: session.messageCount,
    kbIds: session.kbIds ? JSON.parse(session.kbIds) : undefined,
    isArchived: session.isArchived,
  };
}

/**
 * Get chat session by sessionId
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const results = await db.select().from(chatSessions).where(eq(chatSessions.sessionId, sessionId));
  
  if (results.length === 0) {
    return null;
  }
  
  const session = results[0];
  return {
    id: session.id,
    sessionId: session.sessionId,
    title: session.title || undefined,
    createdAt: session.createdAt!,
    updatedAt: session.updatedAt!,
    messageCount: session.messageCount,
    kbIds: session.kbIds ? JSON.parse(session.kbIds) : undefined,
    isArchived: session.isArchived,
  };
}

/**
 * Get all chat sessions
 */
export async function getAllChatSessions(): Promise<ChatSession[]> {
  const results = await db.select()
    .from(chatSessions)
    .where(eq(chatSessions.isArchived, false))
    .orderBy(desc(chatSessions.updatedAt));
  
  return results.map(session => ({
    id: session.id,
    sessionId: session.sessionId,
    title: session.title || undefined,
    createdAt: session.createdAt!,
    updatedAt: session.updatedAt!,
    messageCount: session.messageCount,
    kbIds: session.kbIds ? JSON.parse(session.kbIds) : undefined,
    isArchived: session.isArchived,
  }));
}

/**
 * Update chat session title
 */
export async function updateChatSessionTitle(sessionId: string, title: string): Promise<void> {
  await db.update(chatSessions)
    .set({ 
      title, 
      updatedAt: new Date().toISOString() 
    })
    .where(eq(chatSessions.sessionId, sessionId));
}

/**
 * Delete chat session and all its messages
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  // Delete all messages first
  await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  
  // Delete session
  await db.delete(chatSessions).where(eq(chatSessions.sessionId, sessionId));
}

/**
 * Save message to database
 */
export async function saveChatMessage(
  sessionId: string, 
  message: ChatMessage, 
  messageIndex: number
): Promise<void> {
  console.log("Saving message to database:", {
    role: message.role,
    contentLength: message.content.length,
    messageIndex
  });
  
  await db.insert(chatMessages).values({
    sessionId,
    role: message.role,
    content: message.content,
    messageIndex,
    relatedDocuments: message.relatedDocuments ? JSON.stringify(message.relatedDocuments) : null,
  });
  
  // Update session message count and updated_at
  await db.update(chatSessions)
    .set({ 
      messageCount: messageIndex + 1,
      updatedAt: new Date().toISOString() 
    })
    .where(eq(chatSessions.sessionId, sessionId));
    
  console.log("Message saved successfully to database");
}

/**
 * Get chat messages for a session
 */
export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const results = await db.select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.messageIndex));
  
  console.log("Loading", results.length, "messages from database for session");
  
  return results.map(msg => ({
    role: msg.role as 'human' | 'ai' | 'system',
    content: msg.content,
    relatedDocuments: msg.relatedDocuments ? JSON.parse(msg.relatedDocuments) : undefined,
  }));
}

// Note: Title generation is now handled exclusively by /api/chat/generate-title
// to avoid duplication and ensure consistent behavior with reasoning models
