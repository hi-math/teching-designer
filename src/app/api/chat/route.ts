import Anthropic from '@anthropic-ai/sdk';
import { loadSystemPrompt, buildPageContextBlock } from '@/lib/prompts';
import fs from 'fs';
import path from 'path';

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ ok: false }, { status: 503 });
  }
  return Response.json({ ok: true });
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type StandardEntry = {
  code: string;
  subject: string;
  domain: string;
  content: string;
};

let _standardsCache: StandardEntry[] | null = null;

function loadAllStandards(): StandardEntry[] {
  if (_standardsCache) return _standardsCache;
  try {
    const filePath = path.join(process.cwd(), 'public', 'standard', 'standards_middle.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as { standards: StandardEntry[] };
    _standardsCache = parsed.standards.map((s) => ({
      code: s.code,
      subject: s.subject,
      domain: s.domain,
      content: s.content,
    }));
  } catch {
    _standardsCache = [];
  }
  return _standardsCache!;
}

export async function POST(req: Request) {
  const { messages, stage = 'T', pageContext } = await req.json();

  const selectedCode = pageContext?.selectedActivityCode as string | undefined;
  const enrichedContext = { ...pageContext };

  if (selectedCode === 'A-2-1') {
    enrichedContext.allStandards = loadAllStandards();
  }

  const base = loadSystemPrompt(stage);
  const systemPrompt = enrichedContext
    ? `${base}\n\n${buildPageContextBlock(enrichedContext)}`
    : base;

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: systemPrompt,
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
