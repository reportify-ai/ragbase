import { ChatMessage } from "./service";

// Use memory to store chat history
// Key is session ID, value is array of chat messages
const chatHistories: Map<string, ChatMessage[]> = new Map();

/**
 * Get chat history
 * @param sessionId session ID
 * @returns array of chat messages
 */
export function getChatHistory(sessionId: string): ChatMessage[] {
  return chatHistories.get(sessionId) || [];
}

/**
 * Add message to chat history
 * @param sessionId session ID
 * @param message chat message
 */
export function addMessageToHistory(sessionId: string, message: ChatMessage): void {
  const history = getChatHistory(sessionId);
  history.push(message);
  chatHistories.set(sessionId, history);
}

/**
 * Clear chat history
 * @param sessionId session ID
 */
export function clearChatHistory(sessionId: string): void {
  chatHistories.delete(sessionId);
}

/**
 * Get all session IDs
 * @returns array of session IDs
 */
export function getAllSessionIds(): string[] {
  return Array.from(chatHistories.keys());
} 