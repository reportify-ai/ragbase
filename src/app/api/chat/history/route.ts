import { NextRequest, NextResponse } from 'next/server';
import { getChatHistoryAsync, getAllSessionIds, initializeSession } from '../../../../lib/chat/history';

// Explicitly specify Node.js runtime
export const runtime = 'nodejs';

/**
 * Get chat history for a specific session
 */
export async function GET(req: NextRequest) {
  try {
    // Get session ID from URL parameters
    const sessionId = req.nextUrl.searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID cannot be empty" },
        { status: 400 }
      );
    }
    
    // Get chat history asynchronously (supports database)
    const history = await getChatHistoryAsync(sessionId);
    
    // Also get session info to include knowledge base IDs
    const { getChatSession } = await import('../../../../lib/chat/db');
    const session = await getChatSession(sessionId);
    
    console.log("Returning", history.length, "history messages for session with kbIds:", session?.kbIds);
    
    return NextResponse.json({ 
      history,
      session: session ? {
        kbIds: session.kbIds,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      } : null
    });
  } catch (error) {
    console.error("Get chat history error:", error);
    return NextResponse.json(
      { error: `Failed to get chat history: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

/**
 * Initialize session in database
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, kbIds, title } = await req.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID cannot be empty" },
        { status: 400 }
      );
    }
    
    // Initialize session in database with optional title
    await initializeSession(sessionId, kbIds, title);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Initialize session error:", error);
    return NextResponse.json(
      { error: `Failed to initialize session: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 