import { NextRequest, NextResponse } from 'next/server';
import { updateChatSessionTitle } from '../../../../lib/chat/db';
import { getDefaultModel } from '../../../api/models/db';
import { createChatModel } from '../../../../lib/chat/model';

// Explicitly specify Node.js runtime
export const runtime = 'nodejs';

/**
 * Generate a descriptive title for a chat conversation
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, userMessage, aiResponse } = await req.json();
    
    if (!sessionId || !userMessage) {
      return NextResponse.json(
        { error: "Missing required parameters: sessionId and userMessage are required" },
        { status: 400 }
      );
    }

    // Get default model for title generation
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
      temperature: 0.3, // Lower temperature for more consistent titles
      topP: modelConfig.topP,
      maxTokens: 50, // Limit tokens for short titles
    });

    // Process AI response to remove <think> tags if present
    let cleanAiResponse = '';
    if (aiResponse) {
      // Remove <think> tags and extract only the main content
      cleanAiResponse = aiResponse
        .replace(/<think(?:\s+time=["']?(\d+)["']?)?>([\s\S]*?)<\/think>/g, '') // Remove completed <think> tags
        .replace(/<think(?:\s+time=["']?(\d+)["']?)?>([\s\S]*?)$/g, '') // Remove incomplete <think> tags
        .replace(/\n{3,}/g, '\n\n') // Clean up excessive newlines
        .trim()
        .substring(0, 200); // Limit length
    }

    // Create prompt for title generation based on user message
    const titlePrompt = `Based on the following user question/message, generate a concise, descriptive title (3-8 words) that captures the main topic. The title should be a short phrase, not a single word.

User: ${userMessage.substring(0, 250)}${cleanAiResponse ? `\nAssistant: ${cleanAiResponse}` : ''}

Requirements:
- Use 3-8 words
- Be descriptive and specific
- Capture the main topic or question from the user message
- Use natural language phrases
- Don't use quotes or special characters
- Examples: "Python data analysis tutorial", "React component optimization tips", "Machine learning model comparison"

Generate only the title:`;

    try {
      // Generate title using the model
      console.log("Sending title generation prompt to AI");
      const response = await model.invoke(titlePrompt);
      let rawTitle = response.content as string;
      console.log("Raw AI response for title:", rawTitle);
      
      // Step 1: Remove <think> tags from AI response
      let afterThinkCleanup = rawTitle.trim()
        .replace(/<think(?:\s+time=["']?(\d+)["']?)?>([\s\S]*?)<\/think>/g, '') // Remove completed <think> tags
        .replace(/<think(?:\s+time=["']?(\d+)["']?)?>([\s\S]*?)$/g, '') // Remove incomplete <think> tags
        .replace(/\n{3,}/g, '\n\n') // Clean up excessive newlines
        .trim();
      
      console.log("After removing <think> tags:", afterThinkCleanup);
      
      // Step 2: Standard cleanup
      let title = afterThinkCleanup
        .replace(/^["']|["']$/g, '') // Remove quotes
        .replace(/^Title:\s*/i, '') // Remove "Title:" prefix
        .replace(/\n[\s\S]*$/, '') // Remove everything after first line
        .substring(0, 60); // Limit length
      
      console.log("After standard cleanup:", title);
      
      // Ensure title is not empty and not too short
      if (!title || title.length < 3) {
        console.log("Title too short, using fallback");
        title = "New Conversation";
      }
      
      console.log("Final title:", title);
      
      // Update title in database
      await updateChatSessionTitle(sessionId, title);
      
      return NextResponse.json({ title });
    } catch (modelError) {
      console.error("Error with model generation:", modelError);
      
      // Fallback: generate simple title based on user message
      let fallbackTitle = userMessage.trim()
        .replace(/[?!.]+$/, '') // Remove trailing punctuation
        .substring(0, 50);
      
      if (fallbackTitle.length < 5) {
        fallbackTitle = "New Conversation";
      } else if (fallbackTitle.length < userMessage.trim().length) {
        fallbackTitle += "...";
      }
      
      await updateChatSessionTitle(sessionId, fallbackTitle);
      return NextResponse.json({ title: fallbackTitle });
    }
  } catch (error) {
    console.error("Generate title error:", error);
    return NextResponse.json(
      { error: `Failed to generate title: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
