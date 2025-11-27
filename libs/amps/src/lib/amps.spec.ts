import { AmpsClient } from './amps';

describe('AmpsClient', () => {
  let client: AmpsClient;

  beforeEach(() => {
    client = new AmpsClient('test-client');
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  it('It should be connected', () => {
    client.connect('ws://MontuNobleNumbat2404:9008/amps/json');
    expect(client.isConnected()).toBeTruthy();
    expect(client.getClientName()).toBe('test-client');
  });

  it('should create an instance', () => {
    expect(client).toBeTruthy();
    expect(client.getClientName()).toBe('test-client');
  });

  it('should not be connected initially', () => {
    expect(client.isConnected()).toBe(false);
  });

  it('should allow setting error handler', () => {
    const errorHandler = jest.fn();
    const result = client.errorHandler(errorHandler);

    expect(result).toBe(client); // Should return client for chaining
  });

  it('should allow publishing when not connected throws error', () => {
    expect(() => {
      client.publish('test-topic', { data: 'test' });
    }).toThrow('Not connected to AMPS server');
  });

  it('should allow subscribing when not connected throws error', async () => {
    await expect(
      client.subscribe(() => {}, 'test-topic')
    ).rejects.toThrow('Not connected to AMPS server');
  });

  it('should allow SOW when not connected throws error', async () => {
    await expect(
      client.sow(() => {}, 'test-topic')
    ).rejects.toThrow('Not connected to AMPS server');
  });
});

