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
    console.log("Creating stream for message:", message);
    const langchainStream = await streamingChain.stream(message);
    
    // Create response headers
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    };
    
    // Variables to collect AI response and documents
    let fullAIResponse = '';
    let retrievedDocuments: DocumentReference[] = [];
    
    // Create a ReadableStream from LangChain stream
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Send document information at the start of the stream
          if (chainWithDocs) {
            try {
              // Get retrieved documents
              retrievedDocuments = chainWithDocs.getRetrievedDocuments();
              console.log("Retrieved documents:", retrievedDocuments.length);
              
              if (retrievedDocuments.length > 0) {
                // Create a special format message containing document information
                const docsMessage = JSON.stringify({
                  type: 'documents',
                  documents: retrievedDocuments
                });
                console.log("Sending documents message");
                // Send document information as the first message
                controller.enqueue(new TextEncoder().encode(`${docsMessage}\n---\n`));
              }
            } catch (error) {
              console.error("Error retrieving documents:", error);
            }
          }
          
          // Process LangChain stream
          console.log("Starting to process LangChain stream");
          for await (const chunk of langchainStream) {
            console.log("LangChain chunk:", {
              type: typeof chunk,
              value: typeof chunk === 'string' ? chunk.substring(0, 50) + "..." : chunk
            });
            
            // LangChain StringOutputParser should return strings
            if (typeof chunk === 'string') {
              fullAIResponse += chunk;
              // Encode string to Uint8Array and send to client
              controller.enqueue(new TextEncoder().encode(chunk));
            }
          }
          
          console.log("LangChain stream completed, total response length:", fullAIResponse.length);
          
          // Save to history after stream completes
          const aiMessage: ChatMessage & { relatedDocuments?: DocumentReference[] } = {
            role: "ai",
            content: fullAIResponse,
            ...(retrievedDocuments.length > 0 && { relatedDocuments: retrievedDocuments })
          };
          
          console.log("Saving AI message with content length:", aiMessage.content.length);
          addMessageToHistory(sessionId, aiMessage);
          
        } catch (error) {
          console.error("Error in stream processing:", error);
          controller.error(error);
        } finally {
          controller.close();
        }
      }
    });

    // Create response
    const response = new Response(readableStream, {
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