import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

/**
 * Create chat model instance
 * @param provider provider (ollama or openai)
 * @param modelName model name
 * @param apiUrl API URL
 * @param apiKey API Key (OpenAI needs)
 * @param temperature temperature
 * @param topP Top P
 * @param maxTokens maximum token number
 * @returns chat model instance
 */
export function createChatModel({
  provider,
  modelName,
  apiUrl,
  apiKey,
  temperature = 0.7,
  topP = 1,
  maxTokens = 1024
}: {
  provider: string;
  modelName: string;
  apiUrl: string;
  apiKey?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}): BaseChatModel {
  if (provider.toLowerCase() === 'openai') {
    return new ChatOpenAI({
      modelName,
      openAIApiKey: apiKey,
      temperature,
      topP,
      maxTokens,
      configuration: {
        baseURL: apiUrl,
      }
    });
  } else {
    // Use Ollama by default
    return new ChatOllama({
      model: modelName,
      baseUrl: apiUrl,
      temperature,
      topP,
    });
  }
} 