import { registerApiProvider } from "../api-registry.ts";
import type { Context, Model, SimpleStreamOptions, StreamFunction } from "../types.ts";
import { getProviderEnvValue } from "../utils/provider-env.ts";
import type { OpenAICompletionsOptions } from "./openai-completions.ts";
import { streamOpenAICompletions, streamSimpleOpenAICompletions } from "./openai-completions.ts";

export type OllamaOptions = OpenAICompletionsOptions;

export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";

function resolveOllamaBaseUrl(options?: { env?: Record<string, string> }): string {
	const host = getProviderEnvValue("OLLAMA_HOST", options?.env);
	if (!host) return DEFAULT_OLLAMA_BASE_URL;
	return `${host.replace(/\/$/, "").replace(/\/v1$/, "")}/v1`;
}

function resolveModel(
	model: Model<"openai-completions">,
	options?: { env?: Record<string, string> },
): Model<"openai-completions"> {
	const baseUrl = resolveOllamaBaseUrl(options);
	return baseUrl !== model.baseUrl ? { ...model, baseUrl } : model;
}

export const streamOllama: StreamFunction<"openai-completions", OllamaOptions> = (
	model: Model<"openai-completions">,
	context: Context,
	options?: OllamaOptions,
) => {
	return streamOpenAICompletions(resolveModel(model, options), context, {
		...options,
		apiKey: options?.apiKey ?? "ollama",
	});
};

export const streamSimpleOllama: StreamFunction<"openai-completions", SimpleStreamOptions> = (
	model: Model<"openai-completions">,
	context: Context,
	options?: SimpleStreamOptions,
) => {
	return streamSimpleOpenAICompletions(resolveModel(model, options), context, {
		...options,
		apiKey: options?.apiKey ?? "ollama",
	});
};

export function register(): void {
	registerApiProvider({
		api: "openai-completions",
		stream: streamOllama,
		streamSimple: streamSimpleOllama,
	});
}
