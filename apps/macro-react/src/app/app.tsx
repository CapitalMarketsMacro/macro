import { useEffect } from 'react';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('ReactApp');

export function App() {
  useEffect(() => {
    logger.info('React app initialized');
    logger.debug('This is a debug message');
  }, []);

  return <h1>Hello World</h1>;
}

export default App;
