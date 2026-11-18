import { describe, expect, it } from 'vitest';
import {
  CLAUDE_MODEL,
  claudeVision,
  openaiModeration,
  runModeration,
  type FetchLike,
  type ModerationLayer,
  type ModerationResult,
} from '../src/moderation';
import { FakeLayer } from './helpers';

const IMG = Buffer.from([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
const ok: ModerationResult = { verdict: 'ok', reasons: [] };
const review: ModerationResult = { verdict: 'review', reasons: ['text'] };
const reject: ModerationResult = { verdict: 'reject', reasons: ['nudity'] };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
function fakeFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { fn, calls };
}

describe('runModeration merge table', () => {
  it.each<[ModerationResult, ModerationResult, ModerationResult['verdict']]>([
    [ok, ok, 'ok'],
    [ok, review, 'review'],
    [review, ok, 'review'],
    [review, review, 'review'],
    [reject, ok, 'reject'],
    [ok, reject, 'reject'],
    [review, reject, 'reject'],
    [reject, review, 'reject'],
  ])('%j + %j -> %s', async (a, b, expected) => {
    const res = await runModeration([new FakeLayer('a', a), new FakeLayer('b', b)], IMG);
    expect(res.verdict).toBe(expected);
  });

  it('stops after a reject (does not pay for layer 2)', async () => {
    const l2 = new FakeLayer('b', ok);
    const res = await runModeration([new FakeLayer('a', reject), l2], IMG);
    expect(res).toEqual(reject);
    expect(l2.calls).toBe(0);
  });

  it('collects review reasons', async () => {
    const res = await runModeration([new FakeLayer('a', { verdict: 'review', reasons: ['text'] }), new FakeLayer('b', { verdict: 'review', reasons: ['child', 'text'] })], IMG);
    expect(res).toEqual({ verdict: 'review', reasons: ['text', 'child'] });
  });

  it('no layers -> review', async () => {
    expect((await runModeration([], IMG)).verdict).toBe('review');
  });

  it('a throwing layer -> review, never ok', async () => {
    const boom: ModerationLayer = { name: 'boom', check: async () => Promise.reject(new Error('network down')) };
    const errors: string[] = [];
    const res = await runModeration([boom, new FakeLayer('b', ok)], IMG, { onError: (n) => errors.push(n) });
    expect(res.verdict).toBe('review');
    expect(errors).toEqual(['boom']);
  });

  it('a hanging layer times out -> review', async () => {
    const hang: ModerationLayer = { name: 'hang', check: () => new Promise(() => {}) };
    const res = await runModeration([hang], IMG, { timeoutMs: 20 });
    expect(res.verdict).toBe('review');
  });

  it('a malformed layer result -> review; reject without reasons gets "other"', async () => {
    const bad = { name: 'bad', check: async () => ({ verdict: 'yes' }) as unknown as ModerationResult };
    expect((await runModeration([bad], IMG)).verdict).toBe('review');
    const bare = new FakeLayer('x', { verdict: 'reject', reasons: ['bogus' as never] });
    expect(await runModeration([bare], IMG)).toEqual({ verdict: 'reject', reasons: ['other'] });
  });
});

describe('openaiModeration', () => {
  it('without a key always answers review (and never calls fetch)', async () => {
    const f = fakeFetch(() => jsonResponse({}));
    const layer = openaiModeration({ apiKey: undefined, fetch: f.fn });
    expect(await layer.check(IMG)).toEqual({ verdict: 'review', reasons: [] });
    expect(f.calls).toHaveLength(0);
  });

  it('sends the image as a data URL to omni-moderation-latest', async () => {
    const f = fakeFetch(() => jsonResponse({ results: [{ flagged: false, categories: {}, category_scores: {} }] }));
    const res = await openaiModeration({ apiKey: 'test-key', fetch: f.fn }).check(IMG);
    expect(res.verdict).toBe('ok');
    const { url, init } = f.calls[0];
    expect(url).toBe('https://api.openai.com/v1/moderations');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-key');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('omni-moderation-latest');
    expect(body.input[0].image_url.url).toBe(`data:image/jpeg;base64,${IMG.toString('base64')}`);
  });

  it('maps flagged categories to reason codes', async () => {
    const f = fakeFetch(() =>
      jsonResponse({
        results: [{ flagged: true, categories: { sexual: true, 'violence/graphic': true, 'self-harm/intent': true, hate: false }, category_scores: {} }],
      }),
    );
    const res = await openaiModeration({ apiKey: 'k', fetch: f.fn }).check(IMG);
    expect(res.verdict).toBe('reject');
    expect(res.reasons.sort()).toEqual(['nudity', 'selfHarm', 'violence']);
  });

  it('sexual/minors adds child', async () => {
    const f = fakeFetch(() => jsonResponse({ results: [{ flagged: true, categories: { 'sexual/minors': true }, category_scores: {} }] }));
    expect((await openaiModeration({ apiKey: 'k', fetch: f.fn }).check(IMG)).reasons).toEqual(['nudity', 'child']);
  });

  it('borderline score -> review', async () => {
    const f = fakeFetch(() => jsonResponse({ results: [{ flagged: false, categories: { violence: false }, category_scores: { violence: 0.35, sexual: 0.01 } }] }));
    expect(await openaiModeration({ apiKey: 'k', fetch: f.fn }).check(IMG)).toEqual({ verdict: 'review', reasons: ['violence'] });
  });

  it.each([
    ['HTTP 500', () => jsonResponse({ error: 'x' }, 500)],
    ['bad JSON', () => new Response('not json{', { status: 200 })],
    ['missing results', () => jsonResponse({ foo: 1 })],
  ])('%s -> review via runModeration', async (_n, h) => {
    const f = fakeFetch(h);
    expect((await runModeration([openaiModeration({ apiKey: 'k', fetch: f.fn })], IMG)).verdict).toBe('review');
  });

  it('network error -> review', async () => {
    const fn: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    expect((await runModeration([openaiModeration({ apiKey: 'k', fetch: fn })], IMG)).verdict).toBe('review');
  });
});

describe('claudeVision', () => {
  const answer = (obj: unknown, extra: Record<string, unknown> = {}) =>
    jsonResponse({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }], stop_reason: 'end_turn', ...extra });

  it('without a key always answers review (and never calls fetch)', async () => {
    const f = fakeFetch(() => answer({ verdict: 'ok', reasons: [] }));
    expect((await claudeVision({ apiKey: '', fetch: f.fn }).check(IMG)).verdict).toBe('review');
    expect(f.calls).toHaveLength(0);
  });

  it('sends model, headers, base64 image and a JSON schema', async () => {
    const f = fakeFetch(() => answer({ verdict: 'ok', reasons: [] }));
    expect(await claudeVision({ apiKey: 'test-key', fetch: f.fn }).check(IMG)).toEqual({ verdict: 'ok', reasons: [] });
    const { url, init } = f.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const h = init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('test-key');
    expect(h['anthropic-version']).toBeTruthy();
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe(CLAUDE_MODEL);
    expect(CLAUDE_MODEL).toBe('claude-haiku-5-5');
    expect(body.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: IMG.toString('base64') } });
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.system).toMatch(/cat/);
  });

  it('reject with reasons; unknown reasons filtered', async () => {
    const f = fakeFetch(() => answer({ verdict: 'reject', reasons: ['text', 'symbol', 'nonsense'] }));
    expect(await claudeVision({ apiKey: 'k', fetch: f.fn }).check(IMG)).toEqual({ verdict: 'reject', reasons: ['text', 'symbol'] });
  });

  it('unsure -> review', async () => {
    const f = fakeFetch(() => answer({ verdict: 'unsure', reasons: ['otherPerson'] }));
    expect(await claudeVision({ apiKey: 'k', fetch: f.fn }).check(IMG)).toEqual({ verdict: 'review', reasons: ['otherPerson'] });
  });

  it('accepts JSON inside a code fence', async () => {
    const f = fakeFetch(() => answer('```json\n{"verdict":"ok","reasons":[]}\n```'));
    expect((await claudeVision({ apiKey: 'k', fetch: f.fn }).check(IMG)).verdict).toBe('ok');
  });

  it('refusal -> review', async () => {
    const f = fakeFetch(() => jsonResponse({ content: [], stop_reason: 'refusal' }));
    expect((await claudeVision({ apiKey: 'k', fetch: f.fn }).check(IMG)).verdict).toBe('review');
  });

  it.each([
    ['prose instead of JSON', () => answer('Looks fine to me!')],
    ['unknown verdict', () => answer({ verdict: 'maybe', reasons: [] })],
    ['no text block', () => jsonResponse({ content: [{ type: 'thinking', thinking: '' }] })],
    ['HTTP 529', () => jsonResponse({ type: 'error' }, 529)],
  ])('%s -> review via runModeration', async (_n, h) => {
    const f = fakeFetch(h);
    expect((await runModeration([claudeVision({ apiKey: 'k', fetch: f.fn })], IMG)).verdict).toBe('review');
  });

  it('both real layers without keys -> review', async () => {
    const res = await runModeration([openaiModeration({ apiKey: undefined }), claudeVision({ apiKey: undefined })], IMG);
    expect(res.verdict).toBe('review');
  });
});
