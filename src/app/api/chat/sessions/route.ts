import { NextRequest, NextResponse } from 'next/server';
import { getAllChatSessions, deleteChatSession, updateChatSessionTitle } from '../../../../lib/chat/db';

// Explicitly specify Node.js runtime
export const runtime = 'nodejs';

/**
 * Get all chat sessions
 */
export async function GET() {
  try {
    const sessions = await getAllChatSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Get chat sessions error:", error);
    return NextResponse.json(
      { error: `Failed to get chat sessions: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

/**
 * Update session or delete session
 */
export async function POST(req: NextRequest) {
  try {
    const { action, sessionId, title } = await req.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID cannot be empty" },
        { status: 400 }
      );
    }
    
    if (action === 'delete') {
      await deleteChatSession(sessionId);
      return NextResponse.json({ success: true });
    } else if (action === 'updateTitle') {
      if (!title) {
        return NextResponse.json(
          { error: "Title cannot be empty" },
          { status: 400 }
        );
      }
      await updateChatSessionTitle(sessionId, title);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Manage session error:", error);
    return NextResponse.json(
      { error: `Failed to manage session: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
