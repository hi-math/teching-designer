import Anthropic from '@anthropic-ai/sdk';
import { loadSystemPrompt, buildPageContextBlock } from '@/lib/prompts';

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ ok: false }, { status: 503 });
  }
  return Response.json({ ok: true });
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { messages, stage = 'T', pageContext } = await req.json();
  const base = loadSystemPrompt(stage);
  const systemPrompt = pageContext
    ? `${base}\n\n${buildPageContextBlock(pageContext)}`
    : base;

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: systemPrompt,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
