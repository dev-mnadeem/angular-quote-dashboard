import { parseFeedMessage } from './feed-message';

const quote = {
  symbol: 'AAPL',
  name: 'Apple',
  current: 178.4,
  dayHigh: 179,
  dayLow: 177,
  week52High: 222,
  week52Low: 128,
  previousClose: 178,
  change: 0.4,
  changePercent: 0.22,
  asOf: '2024-06-17T10:00:00.000Z',
};

describe('parseFeedMessage', () => {
  it('parses a snapshot frame with its history', () => {
    const message = parseFeedMessage(
      JSON.stringify({
        type: 'snapshot',
        sequence: 7,
        provider: 'synthetic',
        quotes: [quote],
        history: { AAPL: [1, 2, 3] },
      }),
    );
    expect(message?.type).toBe('snapshot');
    expect(message?.sequence).toBe(7);
    expect(message?.quotes.length).toBe(1);
    if (message?.type === 'snapshot') {
      expect(message.provider).toBe('synthetic');
      expect(message.history['AAPL']).toEqual([1, 2, 3]);
    }
  });

  it('parses a tick frame', () => {
    const message = parseFeedMessage(
      JSON.stringify({ type: 'tick', sequence: 2, quotes: [quote] }),
    );
    expect(message?.type).toBe('tick');
  });

  it('rejects malformed JSON instead of throwing', () => {
    expect(parseFeedMessage('{not json')).toBeNull();
  });

  it('rejects an unknown frame type', () => {
    expect(parseFeedMessage(JSON.stringify({ type: 'trade', quotes: [quote] }))).toBeNull();
  });

  it('rejects a frame whose quotes are not quotes', () => {
    expect(
      parseFeedMessage(JSON.stringify({ type: 'tick', quotes: [{ symbol: 'AAPL' }] })),
    ).toBeNull();
  });

  it('rejects a frame with no quotes array at all', () => {
    expect(parseFeedMessage(JSON.stringify({ type: 'tick' }))).toBeNull();
  });

  it('rejects a quote whose price is not a finite number', () => {
    const broken = { ...quote, current: 'lots' };
    expect(parseFeedMessage(JSON.stringify({ type: 'tick', quotes: [broken] }))).toBeNull();
  });

  it('tolerates a snapshot whose history is the wrong shape', () => {
    const message = parseFeedMessage(
      JSON.stringify({ type: 'snapshot', quotes: [quote], history: 'nope' }),
    );
    expect(message?.type).toBe('snapshot');
    if (message?.type === 'snapshot') expect(message.history).toEqual({});
  });

  it('defaults a missing sequence to zero', () => {
    expect(parseFeedMessage(JSON.stringify({ type: 'tick', quotes: [quote] }))?.sequence).toBe(0);
  });

  it('rejects a bare JSON array', () => {
    expect(parseFeedMessage('[]')).toBeNull();
  });
});
