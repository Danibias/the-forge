import Anthropic from '@anthropic-ai/sdk';
import { EFFORT, MODEL } from './config.js';
import {
  appendMessage,
  deleteMessagesFrom,
  focusToday,
  readLedger,
  readMessages,
  writeLedger,
} from './db.js';
import { applyUpdate, type Ledger } from './ledger.js';
import { systemBlocks } from './prompt.js';
import { TOOLS } from './tools.js';

const client = new Anthropic();

export type ForgeEvent =
  | { type: 'thinking'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'ledger'; ledger: Ledger }
  | { type: 'usage'; input: number; output: number; cache_read: number }
  | { type: 'done' }
  | { type: 'error'; message: string };

function historyForApi(): Anthropic.MessageParam[] {
  return readMessages().map((m) => ({
    role: m.role,
    content: m.content as Anthropic.MessageParam['content'],
  }));
}

/** Only one turn may be in flight — a second stream would fork the history. */
let inFlight = false;
export function isBusy(): boolean {
  return inFlight;
}

/**
 * Run one learner turn to completion: stream the reply, execute any
 * `update_ledger` calls, loop until the model stops asking for tools.
 * Everything that reaches the API is also what we persisted, in order.
 */
export async function runTurn(
  input: { text: string; hidden?: boolean },
  emit: (event: ForgeEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (inFlight) throw new Error('A turn is already in flight.');
  inFlight = true;

  const firstId = appendMessage('user', [{ type: 'text', text: input.text }], input.hidden).id;

  try {
    for (let iteration = 0; iteration < 8; iteration++) {
      const ledger = readLedger();

      const stream = client.messages.stream(
        {
          model: MODEL,
          max_tokens: 32000,
          system: systemBlocks(ledger, focusToday()),
          tools: TOOLS,
          thinking: { type: 'adaptive', display: 'summarized' },
          output_config: { effort: EFFORT },
          messages: historyForApi(),
        },
        { signal },
      );

      for await (const event of stream) {
        if (event.type !== 'content_block_delta') continue;
        if (event.delta.type === 'text_delta') emit({ type: 'delta', text: event.delta.text });
        else if (event.delta.type === 'thinking_delta')
          emit({ type: 'thinking', text: event.delta.thinking });
      }

      const message = await stream.finalMessage();
      appendMessage('assistant', message.content as Anthropic.ContentBlockParam[]);
      emit({
        type: 'usage',
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        cache_read: message.usage.cache_read_input_tokens ?? 0,
      });

      if (message.stop_reason === 'refusal') {
        emit({ type: 'error', message: 'The model declined to continue this turn.' });
        return;
      }
      if (message.stop_reason !== 'tool_use') return;

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of message.content) {
        if (block.type !== 'tool_use') continue;
        if (block.name === 'update_ledger') {
          const updated = applyUpdate(readLedger(), block.input);
          writeLedger(updated);
          emit({ type: 'ledger', ledger: updated });
          results.push({ type: 'tool_result', tool_use_id: block.id, content: 'saved' });
        } else {
          results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `No tool named ${block.name}.`,
            is_error: true,
          });
        }
      }
      appendMessage('user', results, true);
    }

    emit({ type: 'error', message: 'Stopped after 8 tool rounds without finishing.' });
  } catch (error) {
    // Unwind the whole turn so the stored history stays a valid conversation.
    deleteMessagesFrom(firstId);
    throw error;
  } finally {
    inFlight = false;
  }
}

export function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError)
    return 'Anthropic rejected the API key. Check ANTHROPIC_API_KEY in .env.';
  if (error instanceof Anthropic.RateLimitError)
    return 'Rate limited by the Anthropic API. Wait a moment and send again.';
  if (error instanceof Anthropic.APIError) return `Anthropic API error ${error.status}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return 'Unknown error.';
}
