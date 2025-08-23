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
    
    console.log("Returning", history.length, "history messages for session");
    
    return NextResponse.json({ history });
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
    const { sessionId, kbIds } = await req.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID cannot be empty" },
        { status: 400 }
      );
    }
    
    // Initialize session in database
    await initializeSession(sessionId, kbIds);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Initialize session error:", error);
    return NextResponse.json(
      { error: `Failed to initialize session: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 