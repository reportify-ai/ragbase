import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

/**
 * Create default chat prompt template
 * @returns chat prompt template
 */
export function createChatPromptTemplate() {
  return ChatPromptTemplate.fromMessages([
    ["system", `You are a smart assistant that can answer user questions based on the provided context information.
If the question can be answered from the context, please provide an accurate reply based on the context.
If the question cannot be answered from the context, please honestly tell you don't know, don't make up information.
The answer should be concise, accurate, and helpful.`],
    new MessagesPlaceholder("history"),
    ["human", `Context information:
{context}

User question: {question}`],
  ]);
}

/**
 * Create chat prompt template without context
 * @returns chat prompt template
 */
export function createSimpleChatPromptTemplate() {
  return ChatPromptTemplate.fromMessages([
    ["system", `You are a smart assistant that can answer user questions.
The answer should be concise, accurate, and helpful.`],
    new MessagesPlaceholder("history"),
    ["human", "{question}"],
  ]);
} 