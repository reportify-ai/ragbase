import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createChatPromptTemplate, createSimpleChatPromptTemplate } from "./prompt";
import { getLanceDBManager } from "../../llm";
import { DocumentDB } from "../../lib/document/db";

// Set LangChain log level
// In the latest version of LangChain, the log level is set through environment variables
// Optional values: debug, info, warning, error
process.env.LANGCHAIN_VERBOSE = "true"; // Enable detailed log
process.env.LANGCHAIN_LOG_LEVEL = "info"; // Set log level to info

/**
 * Chat message type
 */
export interface ChatMessage {
  role: "human" | "ai" | "system";
  content: string;
}

/**
 * Document reference information type
 */
export type DocumentReference = {
  kbId: number;
  fileId: number;
  fileName: string;
  filePath?: string;  // Add file path field
  title?: string;
  score: number;
  chunkIndex?: number;
};

/**
 * Extended chat chain type
 */
export interface ChatChainWithDocs extends RunnableSequence {
  getRetrievedDocuments: () => DocumentReference[];
}

/**
 * Convert chat history to LangChain message format
 * @param history chat history
 * @returns array of LangChain messages
 */
function convertHistoryToMessages(history: ChatMessage[]) {
  return history.map((message) => {
    if (message.role === "human") {
      return new HumanMessage(message.content);
    } else {
      return new AIMessage(message.content);
    }
  });
}

/**
 * Format retrieved context
 * @param docs array of documents
 * @returns formatted context string
 */
function formatDocumentsAsString(docs: Document[]) {
  return docs.map((doc) => doc.pageContent).join("\n\n");
}

/**
 * Create chat chain with knowledge base
 * @param model chat model
 * @param kbIds array of knowledge base IDs
 * @param history chat history
 * @returns runnable chat chain and retrieved document references
 */
export async function createChatChainWithKB(
  model: BaseChatModel,
  kbIds: number[],
  history: ChatMessage[] = []
): Promise<ChatChainWithDocs> {
  // Create retriever array
  const retrievers = await Promise.all(
    kbIds.map(async (kbId) => {
      const tableName = `kb_${kbId}`;
      const lanceManager = await getLanceDBManager(tableName);
      
      // Create a retrieval function
      return async (query: string) => {
        try {
          const docsWithScores = await lanceManager.similaritySearchWithScores(query, 5);
          const docs = docsWithScores.map(item => item[0]);
          console.log("Retrieved docs:", docs);        
          
          // Save score information
          const docReferences: DocumentReference[] = docsWithScores.map(([doc, score]) => ({
            kbId,
            fileId: doc.metadata.fileId,
            fileName: doc.metadata.fileName || "",
            filePath: doc.metadata.filePath,
            title: doc.metadata.title,
            score: doc.metadata._distance ? (1/doc.metadata._distance+1) : 1,
            chunkIndex: doc.metadata.chunkIndex
          }));
          
          console.log(`KB ${kbId} retrieved ${docReferences.length} document references`);
          return { docs, docReferences };
        } catch (error) {
          console.error(`Error retrieving from KB ${kbId}:`, error);
          return { docs: [], docReferences: [] };
        }
      };
    })
  );

  // Create chat prompt template
  const chatPrompt = createChatPromptTemplate();

  // Save retrieved document references
  let retrievedDocReferences: DocumentReference[] = [];

  // Create chat chain
  const chain = RunnableSequence.from([
    {
      question: new RunnablePassthrough(),
      history: async () => history.length > 0 ? convertHistoryToMessages(history) : [],
      context: async (input: string) => {
        // Get documents from all retrievers
        const retrievalResults = await Promise.all(
          retrievers.map(retriever => retriever(input))
        );
        
        // Merge all documents and document references
        const allDocs = retrievalResults.flatMap(result => result.docs);
        const allDocReferences = retrievalResults.flatMap(result => result.docReferences);
        
        console.log("All retrieval results:", retrievalResults.length);
        console.log("Total docs retrieved:", allDocs.length);
        console.log("Total doc references before merging:", allDocReferences.length);
        
        // Merge documents with the same fileId, keep the document with the highest relevance (lowest score)
        retrievedDocReferences = mergeDocumentsByFileId(allDocReferences);
        
        console.log("Total doc references after merging:", retrievedDocReferences.length);
        
        // Format documents
        return formatDocumentsAsString(allDocs);
      },
    },
    chatPrompt,
    model,
    new StringOutputParser(),
  ]);

  // Return chat chain and document reference retrieval function
  return Object.assign(chain, {
    getRetrievedDocuments: () => retrievedDocReferences
  }) as ChatChainWithDocs;
}

/**
 * Merge documents by fileId, ensure a document only exists once
 * @param documents array of document references
 * @returns merged document references
 */
function mergeDocumentsByFileId(documents: DocumentReference[]): DocumentReference[] {
  // Create a Map, with fileId as the key
  const fileIdMap = new Map<number, DocumentReference>();
  
  // Traverse all documents, only keep the first occurrence
  for (const doc of documents) {
    // If the document does not exist in the Map, add it
    if (!fileIdMap.has(doc.fileId)) {
      fileIdMap.set(doc.fileId, doc);
    }
    // If it already exists, skip, do not process
  }
  
  // Convert Map to array and return
  return Array.from(fileIdMap.values());
}

/**
 * Create simple chat chain (no knowledge base)
 * @param model chat model
 * @param history chat history
 * @returns runnable chat chain
 */
export function createSimpleChatChain(
  model: BaseChatModel,
  history: ChatMessage[] = []
) {
  // Create chat prompt template
  const chatPrompt = createSimpleChatPromptTemplate();

  // Create chat chain
  return RunnableSequence.from([
    {
      question: new RunnablePassthrough(),
      history: async () => history.length > 0 ? convertHistoryToMessages(history) : [],
    },
    chatPrompt,
    model,
    new StringOutputParser(),
  ]);
} 