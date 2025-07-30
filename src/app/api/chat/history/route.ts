import { NextRequest, NextResponse } from 'next/server';
import { getChatHistory, getAllSessionIds } from '../../../../lib/chat/history';

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
    
    // Get chat history
    const history = getChatHistory(sessionId);
    
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
 * Get all session IDs
 */
export async function POST() {
  try {
    // Get all session IDs
    const sessionIds = getAllSessionIds();
    
    return NextResponse.json({ sessionIds });
  } catch (error) {
    console.error("Get all session IDs error:", error);
    return NextResponse.json(
      { error: `Failed to get all session IDs: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 