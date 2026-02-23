import { Logger, LogLevel } from './logger';

describe('Logger', () => {
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    // Reset global level to TRACE so all tests start permissive
    Logger.setGlobalLevel(LogLevel.TRACE);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  describe('instance management', () => {
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
  });

  describe('basic logging', () => {
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

  describe('level filtering', () => {
    it('should NOT log info when level is ERROR', () => {
      const logger = Logger.getLogger('FilterInfo');
      logger.setLevel(LogLevel.ERROR);
      stdoutSpy.mockClear();
      stderrSpy.mockClear();

      logger.info('Should be suppressed');
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('should NOT log debug when level is WARN', () => {
      const logger = Logger.getLogger('FilterDebug');
      logger.setLevel(LogLevel.WARN);
      stdoutSpy.mockClear();

      logger.debug('Should be suppressed');
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('should log debug when level is TRACE', () => {
      const logger = Logger.getLogger('AllowDebug');
      logger.setLevel(LogLevel.TRACE);
      stdoutSpy.mockClear();

      logger.debug('Should appear');
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('should NOT log warn when level is ERROR', () => {
      const logger = Logger.getLogger('FilterWarn');
      logger.setLevel(LogLevel.ERROR);
      stderrSpy.mockClear();

      logger.warn('Should be suppressed');
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('should log error when level is ERROR', () => {
      const logger = Logger.getLogger('AllowError');
      logger.setLevel(LogLevel.ERROR);
      stderrSpy.mockClear();

      logger.error('Should appear');
      expect(stderrSpy).toHaveBeenCalled();
    });
  });

  describe('data arguments', () => {
    it('should log info with object data', () => {
      const logger = Logger.getLogger('DataObj');
      logger.info('With object', { key: 'val' });
      expect(stdoutSpy).toHaveBeenCalled();
      const output = stdoutSpy.mock.calls[0][0];
      expect(output).toContain('With object');
    });

    it('should log info with string data', () => {
      const logger = Logger.getLogger('DataStr');
      logger.info('With string', 'extra info');
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('should log info with number data', () => {
      const logger = Logger.getLogger('DataNum');
      logger.info('With number', 42);
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('should log debug with object data', () => {
      const logger = Logger.getLogger('DebugDataObj');
      logger.debug('Debug data', { a: 1 });
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('should log debug with string data', () => {
      const logger = Logger.getLogger('DebugDataStr');
      logger.debug('Debug str', 'details');
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('should log debug with number data', () => {
      const logger = Logger.getLogger('DebugDataNum');
      logger.debug('Debug num', 99);
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('should log warn with object data', () => {
      const logger = Logger.getLogger('WarnDataObj');
      logger.warn('Warn data', { warning: true });
      expect(stderrSpy).toHaveBeenCalled();
    });

    it('should log warn with string data', () => {
      const logger = Logger.getLogger('WarnDataStr');
      logger.warn('Warn str', 'warning detail');
      expect(stderrSpy).toHaveBeenCalled();
    });

    it('should log warn with number data', () => {
      const logger = Logger.getLogger('WarnDataNum');
      logger.warn('Warn num', 7);
      expect(stderrSpy).toHaveBeenCalled();
    });

    it('should log error with object data', () => {
      const logger = Logger.getLogger('ErrorDataObj');
      logger.error('Error data', { code: 500 });
      expect(stderrSpy).toHaveBeenCalled();
    });

    it('should log error with string data', () => {
      const logger = Logger.getLogger('ErrorDataStr');
      logger.error('Error str', 'stack trace');
      expect(stderrSpy).toHaveBeenCalled();
    });

    it('should log error with number data', () => {
      const logger = Logger.getLogger('ErrorDataNum');
      logger.error('Error num', 404);
      expect(stderrSpy).toHaveBeenCalled();
    });
  });

  describe('setLevel / getLevel', () => {
    it('should set level with LogLevel enum', () => {
      const logger = Logger.getLogger('SetLevelEnum');
      logger.setLevel(LogLevel.WARN);
      expect(logger.getLevel()).toBe('WARN');
      expect(logger.getLevelNumber()).toBe(LogLevel.WARN);
    });

    it('should set level with string argument', () => {
      const logger = Logger.getLogger('SetLevelStr');
      logger.setLevel('error');
      expect(logger.getLevel()).toBe('ERROR');
      expect(logger.getLevelNumber()).toBe(LogLevel.ERROR);
    });

    it('should return correct level after multiple changes', () => {
      const logger = Logger.getLogger('SetLevelMulti');
      logger.setLevel(LogLevel.DEBUG);
      expect(logger.getLevelNumber()).toBe(LogLevel.DEBUG);

      logger.setLevel(LogLevel.FATAL);
      expect(logger.getLevelNumber()).toBe(LogLevel.FATAL);
      expect(logger.getLevel()).toBe('FATAL');
    });
  });

  describe('global level', () => {
    it('should set and get global level', () => {
      Logger.setGlobalLevel(LogLevel.ERROR);
      expect(Logger.getGlobalLevel()).toBe('ERROR');
      expect(Logger.getGlobalLevelNumber()).toBe(LogLevel.ERROR);
    });

    it('should set global level with string', () => {
      Logger.setGlobalLevel('warn');
      expect(Logger.getGlobalLevel()).toBe('WARN');
      expect(Logger.getGlobalLevelNumber()).toBe(LogLevel.WARN);
    });

    it('should propagate global level to existing loggers', () => {
      const logger = Logger.getLogger('GlobalProp');
      Logger.setGlobalLevel(LogLevel.ERROR);
      expect(logger.getLevelNumber()).toBe(LogLevel.ERROR);
    });
  });

  describe('LogLevel enum', () => {
    it('should have correct numeric values', () => {
      expect(LogLevel.TRACE).toBe(10);
      expect(LogLevel.DEBUG).toBe(20);
      expect(LogLevel.INFO).toBe(30);
      expect(LogLevel.WARN).toBe(40);
      expect(LogLevel.ERROR).toBe(50);
      expect(LogLevel.FATAL).toBe(60);
    });
  });
});
