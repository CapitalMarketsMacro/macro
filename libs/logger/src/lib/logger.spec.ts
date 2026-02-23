import { Logger } from './logger';

describe('Logger', () => {
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
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
    const logger = Logger.getLogger('InfoCtx');
    logger.info('Test message');
    expect(stdoutSpy).toHaveBeenCalled();
  });

  it('should log debug messages', () => {
    const logger = Logger.getLogger('DebugCtx');
    logger.debug('Debug message');
    expect(stdoutSpy).toHaveBeenCalled();
  });

  it('should log error messages', () => {
    const logger = Logger.getLogger('ErrorCtx');
    logger.error('Error message');
    expect(stderrSpy).toHaveBeenCalled();
  });

  it('should log warn messages', () => {
    const logger = Logger.getLogger('WarnCtx');
    logger.warn('Warning message');
    expect(stderrSpy).toHaveBeenCalled();
  });
});
