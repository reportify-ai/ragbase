import { ChatMessage } from "./service";
import { 
  getChatSession, 
  createChatSession, 
  getChatMessages, 
  saveChatMessage, 
  deleteChatSession as deleteChatSessionFromDB,
  updateChatSessionTitle,
  updateChatSessionKbIds
} from "./db";

// Use memory to store chat history for backward compatibility
// Key is session ID, value is array of chat messages
const chatHistories: Map<string, ChatMessage[]> = new Map();

/**
 * Get chat history - now supports both memory and database
 * @param sessionId session ID
 * @returns array of chat messages
 */
export function getChatHistory(sessionId: string): ChatMessage[] {
  // First try memory cache
  const memoryHistory = chatHistories.get(sessionId);
  if (memoryHistory && memoryHistory.length > 0) {
    return memoryHistory;
  }
  
  // If not in memory, try to load from database
  // Note: This is a sync function but we need async DB call
  // We'll handle this in the updated API calls
  return [];
}

/**
 * Get chat history from database (async version)
 * @param sessionId session ID
 * @returns array of chat messages
 */
export async function getChatHistoryAsync(sessionId: string): Promise<ChatMessage[]> {
  // First try memory cache
  const memoryHistory = chatHistories.get(sessionId);
  if (memoryHistory && memoryHistory.length > 0) {
    return memoryHistory;
  }
  
  // Load from database
  try {
    const dbMessages = await getChatMessages(sessionId);
    if (dbMessages.length > 0) {
      // Cache in memory for faster access
      chatHistories.set(sessionId, dbMessages);
      return dbMessages;
    }
  } catch (error) {
    console.error('Error loading chat history from database:', error);
  }
  
  return [];
}

/**
 * Add message to chat history - now supports both memory and database
 * @param sessionId session ID
 * @param message chat message (can include relatedDocuments)
 */
export function addMessageToHistory(sessionId: string, message: ChatMessage | (ChatMessage & { relatedDocuments?: any[] })): void {
  // Add to memory cache
  const history = chatHistories.get(sessionId) || [];
  history.push(message as ChatMessage);
  chatHistories.set(sessionId, history);
  
  // Save to database asynchronously
  saveToDatabaseAsync(sessionId, message as ChatMessage, history.length - 1);
}

/**
 * Save message to database asynchronously
 */
async function saveToDatabaseAsync(sessionId: string, message: ChatMessage, messageIndex: number): Promise<void> {
  try {
    // Ensure session exists
    let session = await getChatSession(sessionId);
    if (!session) {
      session = await createChatSession(sessionId);
    }
    
    // Save message
    await saveChatMessage(sessionId, message, messageIndex);
    
    // Title generation is now handled only when user sends first message
    // No longer generate title after AI response to avoid duplicates
  } catch (error) {
    console.error('Error saving to database:', error);
  }
}

/**
 * Clear chat history
 * @param sessionId session ID
 */
export function clearChatHistory(sessionId: string): void {
  chatHistories.delete(sessionId);
  
  // Also delete from database asynchronously
  deleteChatSessionFromDB(sessionId).catch(error => {
    console.error('Error deleting from database:', error);
  });
}

/**
 * Get all session IDs from memory
 * @returns array of session IDs
 */
export function getAllSessionIds(): string[] {
  return Array.from(chatHistories.keys());
}

/**
 * Initialize session in database if not exists
 * @param sessionId session ID
 * @param kbIds knowledge base IDs
 */
export async function initializeSession(sessionId: string, kbIds?: number[], title?: string): Promise<void> {
  try {
    const existingSession = await getChatSession(sessionId);
    
    if (!existingSession) {
      await createChatSession(sessionId, kbIds, title);
    } else {
      // Update existing session with new kbIds and title if provided
      if (kbIds !== undefined) {
        await updateChatSessionKbIds(sessionId, kbIds);
      }
      if (title && title !== existingSession.title) {
        await updateChatSessionTitle(sessionId, title);
      }
    }
  } catch (error) {
    console.error('Error initializing session:', error);
  }
} 