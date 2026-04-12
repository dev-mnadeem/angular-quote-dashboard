import Anthropic from '@anthropic-ai/sdk';
import { summarise } from './heuristic.js';

const SYSTEM = [
  'You write one sentence of market commentary for a four-symbol dashboard.',
  'Use only the numbers you are given. Never invent news, causes or context.',
  'Maximum 30 words. No preamble, no markdown, no trailing questions.',
].join(' ');

/** A single sentence needs very little room, and the cap keeps latency predictable. */
const MAX_TOKENS = 200;

/**
 * Model-written commentary. Every failure path — no key, API error, refusal,
 * empty response — falls back to the deterministic summary, so enabling this
 * provider can make the sentence better but can never make the page break.
 */
export function createAnthropicCommentary({ apiKey, model, client = null, onError = () => {} }) {
  if (!apiKey && !client)
    throw new Error('ANTHROPIC_API_KEY is required for the anthropic provider');
  const anthropic = client ?? new Anthropic({ apiKey });

  return {
    name: 'anthropic',
    requiresCredentials: true,
    async write(quotes) {
      const table = quotes
        .map(
          (q) =>
            `${q.symbol} (${q.name}) ${q.current} vs prior close ${q.previousClose}, ${q.changePercent}%`,
        )
        .join('\n');
      try {
        const response = await anthropic.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          system: SYSTEM,
          output_config: { effort: 'low' },
          messages: [{ role: 'user', content: `Current board:\n${table}` }],
        });
        if (response.stop_reason === 'refusal') throw new Error('request was declined');
        const text = response.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('')
          .trim();
        if (!text) throw new Error('empty response');
        return text;
      } catch (err) {
        onError(err);
        return summarise(quotes);
      }
    },
  };
}
