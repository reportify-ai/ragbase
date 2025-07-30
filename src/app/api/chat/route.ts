import { NextRequest, NextResponse } from 'next/server';
import { getDefaultModel } from '../models/db';
import { createChatModel } from '../../../lib/chat/model';
import { createChatChainWithKB, createSimpleChatChain, ChatMessage, DocumentReference, ChatChainWithDocs } from '../../../lib/chat/service';
import { getChatHistory, addMessageToHistory } from '../../../lib/chat/history';
import { RunnableSequence } from '@langchain/core/runnables';

// 明确指定使用 Node.js 运行时
export const runtime = 'nodejs';

/**
 * 聊天请求参数类型
 */
interface ChatRequest {
  message: string;
  sessionId: string;
  kbIds?: number[];
}

/**
 * 聊天API - 流式响应
 */
export async function POST(req: NextRequest) {
  try {
    // 解析请求体，默认kbIds为undefined而不是[1]，让后续逻辑处理默认值
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

    // 获取历史记录
    const history = getChatHistory(sessionId);
    
    // 添加用户消息到历史记录
    addMessageToHistory(sessionId, { role: "human", content: message });

    // 获取默认模型
    const modelConfig = await getDefaultModel();
    if (!modelConfig) {
      return NextResponse.json(
        { error: "No default model configured" },
        { status: 500 }
      );
    }

    // 创建聊天模型
    const model = createChatModel({
      provider: modelConfig.provider,
      modelName: modelConfig.name,
      apiUrl: modelConfig.apiUrl,
      apiKey: modelConfig.apiKey || undefined,
      temperature: modelConfig.temperature,
      topP: modelConfig.topP,
      maxTokens: modelConfig.maxTokens,
    });

    // 处理kbIds参数
    // 1. 如果kbIds是undefined或null，使用默认知识库[1]
    // 2. 如果kbIds是空数组或包含空字符串，表示用户明确选择不使用知识库
    // 3. 否则使用用户提供的kbIds
    const useKbIds = kbIds === undefined || kbIds === null 
      ? [1] // 默认使用ID为1的知识库
      : (Array.isArray(kbIds) && kbIds.length === 0) || 
        (Array.isArray(kbIds) && kbIds.length === 1 && kbIds[0].toString() === '') 
        ? [] // 空数组或['']表示不使用知识库
        : kbIds; // 使用用户提供的知识库IDs

    // 创建聊天链
    let chainWithDocs: ChatChainWithDocs | null = null;
    let streamingChain: RunnableSequence;
    
    if (useKbIds.length > 0) {
      // 使用知识库
      chainWithDocs = await createChatChainWithKB(model, useKbIds, history);
      streamingChain = chainWithDocs;
      console.log("Knowledge base chain created, continuing with stream");
    } else {
      // 不使用知识库
      streamingChain = createSimpleChatChain(model, history);
    }

    // 创建流式响应
    const stream = await streamingChain.stream(message);
    
    // 创建响应头
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    };
    
    // 创建一个新的 TransformStream 来处理流式响应
    let fullAIResponse = '';
    
    const transformStream = new TransformStream({
      async start(controller) {
        // 在流开始时发送文档信息
        if (chainWithDocs) {
          try {
            // 获取检索到的文档，设置超时避免无限等待
            const retrievedDocumentsPromise = Promise.race([
              new Promise<DocumentReference[]>((resolve) => {
                // 尝试获取文档，如果成功则返回
                const docs = chainWithDocs!.getRetrievedDocuments();
                resolve(docs);
              }),
              new Promise<DocumentReference[]>((resolve) => {
                // 如果超过2秒还没有获取到文档，则返回空数组
                setTimeout(() => {
                  console.log("Document retrieval timed out, continuing without documents");
                  resolve([]);
                }, 2000);
              })
            ]);
            
            const retrievedDocuments = await retrievedDocumentsPromise;
            console.log("Retrieved documents:", JSON.stringify(retrievedDocuments));
            
            if (retrievedDocuments.length > 0) {
              // 创建一个特殊格式的消息，包含文档信息
              const docsMessage = JSON.stringify({
                type: 'documents',
                documents: retrievedDocuments
              });
              console.log("Sending documents message:", docsMessage.substring(0, 100) + "...");
              // 发送文档信息作为第一个消息
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
        // 直接将块传递给输出
        controller.enqueue(chunk);
        
        // 只有当 chunk 是有效的 ArrayBuffer 或 ArrayBufferView 时才尝试解码
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
        // 流结束时，将完整响应添加到历史记录
        console.log("Stream ended, saving response to history");
        addMessageToHistory(sessionId, { role: "ai", content: fullAIResponse });
      }
    });

    // 创建响应
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
 * 清除聊天历史API
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
    
    // 清除历史记录
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