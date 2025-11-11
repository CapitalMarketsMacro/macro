import { Logger } from './logger';

describe('Logger', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should create logger with context', () => {
    const logger = Logger.getLogger('TestContext');
    expect(logger.getContext()).toBe('TestContext');
  });

  it('should return same instance for same context', () => {
    const logger1 = Logger.getLogger('TestContext');
    const logger2 = Logger.getLogger('TestContext');
    expect(logger1).toBe(logger2);
  });

  it('should return different instances for different contexts', () => {
    const logger1 = Logger.getLogger('Context1');
    const logger2 = Logger.getLogger('Context2');
    expect(logger1).not.toBe(logger2);
    expect(logger1.getContext()).toBe('Context1');
    expect(logger2.getContext()).toBe('Context2');
  });

  it('should log info messages with context', () => {
    const logger = Logger.getLogger('TestContext');
    logger.info('Test message');
    // Pino will format the message, so we just check that info was called
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should log debug messages', () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
    const logger = Logger.getLogger('TestContext');
    logger.debug('Debug message');
    expect(debugSpy).toHaveBeenCalled();
    debugSpy.mockRestore();
  });

  it('should log error messages', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    const logger = Logger.getLogger('TestContext');
    logger.error('Error message');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should log warn messages', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const logger = Logger.getLogger('TestContext');
    logger.warn('Warning message');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
