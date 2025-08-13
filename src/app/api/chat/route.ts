import { NextRequest, NextResponse } from 'next/server';
import { getDefaultModel } from '../models/db';
import { createChatModel } from '../../../lib/chat/model';
import { createChatChainWithKB, createSimpleChatChain, ChatMessage, DocumentReference, ChatChainWithDocs } from '../../../lib/chat/service';
import { getChatHistory, addMessageToHistory } from '../../../lib/chat/history';
import { RunnableSequence } from '@langchain/core/runnables';

// Explicitly specify Node.js runtime
export const runtime = 'nodejs';

/**
 * Chat request parameter type
 */
interface ChatRequest {
  message: string;
  sessionId: string;
  kbIds?: number[];
}

/**
 * Chat API - Streaming response
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body, default kbIds to undefined instead of [1], let subsequent logic handle default values
    const { message, sessionId, kbIds } = await req.json() as ChatRequest;
    
    if (!message) {
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID cannot be empty" },
        { status: 400 }
      );
    }

    // Get chat history
    const history = getChatHistory(sessionId);
    
    // Add user message to history
    addMessageToHistory(sessionId, { role: "human", content: message });

    // Get default model
    const modelConfig = await getDefaultModel();
    if (!modelConfig) {
      return NextResponse.json(
        { error: "No default model configured" },
        { status: 500 }
      );
    }

    // Create chat model
    const model = createChatModel({
      provider: modelConfig.provider,
      modelName: modelConfig.name,
      apiUrl: modelConfig.apiUrl,
      apiKey: modelConfig.apiKey || undefined,
      temperature: modelConfig.temperature,
      topP: modelConfig.topP,
      maxTokens: modelConfig.maxTokens,
    });

    // Handle kbIds parameter
    // 1. If kbIds is undefined or null, use default knowledge base [1]
    // 2. If kbIds is empty array or contains empty string, user explicitly chooses not to use knowledge base
    // 3. Otherwise use user provided kbIds
    const useKbIds = kbIds === undefined || kbIds === null 
      ? [1] // Default to knowledge base with ID 1
      : (Array.isArray(kbIds) && kbIds.length === 0) || 
        (Array.isArray(kbIds) && kbIds.length === 1 && kbIds[0].toString() === '') 
        ? [] // Empty array or [''] means not using knowledge base
        : kbIds; // Use user provided knowledge base IDs

    // Create chat chain
    let chainWithDocs: ChatChainWithDocs | null = null;
    let streamingChain: RunnableSequence;
    
    if (useKbIds.length > 0) {
      // Use knowledge base
      chainWithDocs = await createChatChainWithKB(model, useKbIds, history);
      streamingChain = chainWithDocs;
      console.log("Knowledge base chain created, continuing with stream");
    } else {
      // Don't use knowledge base
      streamingChain = createSimpleChatChain(model, history);
    }

    // Create streaming response
    const stream = await streamingChain.stream(message);
    
    // Create response headers
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    };
    
    // Create a new TransformStream to handle streaming response
    let fullAIResponse = '';
    
    const transformStream = new TransformStream({
      async start(controller) {
        // Send document information at the start of the stream
        if (chainWithDocs) {
          try {
            // Get retrieved documents, set timeout to avoid infinite waiting
            const retrievedDocumentsPromise = Promise.race([
              new Promise<DocumentReference[]>((resolve) => {
                // Try to get documents, return if successful
                const docs = chainWithDocs!.getRetrievedDocuments();
                resolve(docs);
              }),
              new Promise<DocumentReference[]>((resolve) => {
                // If no documents retrieved within 2 seconds, return empty array
                setTimeout(() => {
                  console.log("Document retrieval timed out, continuing without documents");
                  resolve([]);
                }, 2000);
              })
            ]);
            
            const retrievedDocuments = await retrievedDocumentsPromise;
            console.log("Retrieved documents:", JSON.stringify(retrievedDocuments));
            
            if (retrievedDocuments.length > 0) {
              // Create a special format message containing document information
              const docsMessage = JSON.stringify({
                type: 'documents',
                documents: retrievedDocuments
              });
              console.log("Sending documents message:", docsMessage.substring(0, 100) + "...");
              // Send document information as the first message
              controller.enqueue(new TextEncoder().encode(`${docsMessage}\n---\n`));
            } else {
              console.log("No documents to send");
            }
          } catch (error) {
            console.error("Error retrieving documents:", error);
            console.log("Continuing without documents");
          }
        }
      },
      transform(chunk, controller) {
        // Pass chunk directly to output
        controller.enqueue(chunk);
        
        // Only try to decode if chunk is a valid ArrayBuffer or ArrayBufferView
        if (chunk instanceof Uint8Array) {
          try {
            const text = new TextDecoder().decode(chunk);
            fullAIResponse += text;
          } catch (error) {
            console.error("Error decoding chunk:", error);
          }
        }
      },
      flush(controller) {
        // When stream ends, add complete response to history
        console.log("Stream ended, saving response to history");
        addMessageToHistory(sessionId, { role: "ai", content: fullAIResponse });
      }
    });

    // Create response
    const response = new Response(stream.pipeThrough(transformStream), {
      headers: responseHeaders,
    });

    return response;
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: `Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

/**
 * Clear chat history API
 */
export async function DELETE(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID cannot be empty" },
        { status: 400 }
      );
    }
    
    // Clear history
    const { clearChatHistory } = await import('../../../lib/chat/history');
    clearChatHistory(sessionId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clear chat history error:", error);
    return NextResponse.json(
      { error: `Failed to clear chat history: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 