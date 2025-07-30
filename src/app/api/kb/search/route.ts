import { NextRequest, NextResponse } from 'next/server';
import { getLanceDBManager } from '../../../../llm';

// 明确指定使用 Node.js 运行时
export const runtime = 'nodejs';

/**
 * Vector Search API
 * Accepts POST requests to query the vector database of a specified knowledge base
 * and returns relevant text chunks
 */
export async function POST(req: NextRequest) {
  try {
    const { kbId, query, limit = 5 } = await req.json();
    
    if (!kbId || !query) {
      return NextResponse.json(
        { error: "Knowledge base ID and query cannot be empty" },
        { status: 400 }
      );
    }

    // Get LanceDB manager for the knowledge base
    const tableName = `kb_${kbId}`;
    const lanceManager = await getLanceDBManager(tableName);
    
    // Perform similarity search with scores
    const results = await lanceManager.similaritySearchWithScores(query, Number(limit));
    const rjson = results.map(([doc, score]) => ({
        content: doc.pageContent,
        metadata: doc.metadata,
        score: score // 包含相似度分数（距离值，越小表示越相似）
      }))
    console.log(rjson);
    return NextResponse.json({
      results: rjson
    });
  } catch (error) {
    console.error("Vector search failed:", error);
    return NextResponse.json(
      { error: `Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 