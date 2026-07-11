import { AmpsTransport } from './amps-transport';

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockSowAndSubscribe = jest.fn().mockResolvedValue('sub-sow');

jest.mock('amps', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    sowAndSubscribe: mockSowAndSubscribe,
  })),
  Command: jest.fn(),
}));

jest.mock('@macro/logger', () => ({
  Logger: {
    getLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

describe('AmpsTransport SOW options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('encodes topN as a top_n command option, preserves raw options, and omits the local timeout', async () => {
    const transport = new AmpsTransport('test-amps');
    await transport.connect({ url: 'ws://x/amps/json' });

    await transport.sowAndSubscribe('orders', "/status = 'OPEN'", {
      topN: 25,
      orderBy: '/price DESC, /symbol ASC',
      options: 'send_oof,top_n=10,projection=[/desk,/pnl]',
      timeout: 5000,
    });

    expect(mockSowAndSubscribe).toHaveBeenCalledWith(
      expect.any(Function),
      'orders',
      "/status = 'OPEN'",
      {
        orderBy: '/price DESC, /symbol ASC',
        options: 'send_oof,projection=[/desk,/pnl],top_n=25',
      },
    );
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'rejects invalid topN value %s',
    async (topN) => {
      const transport = new AmpsTransport('test-amps');
      await transport.connect({ url: 'ws://x/amps/json' });

      await expect(
        transport.sowAndSubscribe('orders', undefined, { topN }),
      ).rejects.toThrow('AMPS topN must be a positive integer.');
      expect(mockSowAndSubscribe).not.toHaveBeenCalled();
    },
  );
});
