/**
 * Test client for AMPS (Advanced Message Processing System) connection
 *
 * This is a test/demo client that connects to an AMPS server.
 * Run this file to test the AmpsClient implementation.
 *
 * Usage:
 *   - For Node.js: ts-node libs/amps/src/lib/amps.test-client.ts
 *   - Or compile and run: node dist/libs/amps/src/lib/amps.test-client.js
 */

import { AmpsClient } from './amps';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('AmpsTestClient');

async function testAmpsConnection() {
  logger.info('Creating AMPS client...');
  const client = new AmpsClient('amps-test-client');

  // Set up error handler before connecting
  client.errorHandler(async (error) => {
    logger.error('AMPS Error', { message: error.message, stack: error.stack });
  });

  try {
    logger.info('Connecting to AMPS server...');
    const ampsUrl = 'ws://MontuNobleNumbat2404:9008/amps/json';
    await client.connect(ampsUrl);

    logger.info('Successfully connected to AMPS server!');

    // Test subscribing to a topic
    logger.info('Subscribing to test topic...');
    const { observable, subId } = await client.subscribeAsObservable('test/topic');

    logger.info(`Subscribed to 'test/topic' with subscription ID: ${subId}`);

    // Listen for messages
    const subscription = observable.subscribe({
      next: (message) => {
        logger.info('Received message', {
          topic: message.topic,
          subId: message.subId,
          sequence: message.sequence,
        });
        
        // Display message data
        if (typeof message.data === 'string') {
          logger.info('Message content (string)', { data: message.data });
        } else {
          logger.info('Message content (object)', message.data);
        }
        
        // Display header if available
        if (message.header) {
          logger.info('Message header command', { command: message.header.command?.() });
        }
      },
      error: (error) => {
        logger.error('Subscription error', error);
      },
      complete: () => {
        logger.info('Subscription completed');
      },
    });

    // Test publishing 5 messages
    logger.info('Publishing 5 test messages...');
    for (let i = 1; i <= 5; i++) {
      client.publish('test/topic', { 
        message: `Hello from AmpsClient test! Message #${i}`,
        messageNumber: i,
        timestamp: Date.now(),
        clientName: 'amps-test-client'
      });
      logger.info(`Message ${i}/5 published`);
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    logger.info('All 5 messages published');

    // Keep connection alive for a bit to receive messages
    logger.info('Waiting for messages (press Ctrl+C to exit)...');
    logger.info('Connection will stay open for 30 seconds...');

    // Wait for 30 seconds then disconnect
    setTimeout(async () => {
      logger.info('Disconnecting...');
      subscription.unsubscribe();
      await client.unsubscribe(subId);
      await client.disconnect();
      logger.info('Disconnected successfully');
      process.exit(0);
    }, 30000);

  } catch (error) {
    logger.error('Connection failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAmpsConnection().catch((error) => {
    logger.error('Test failed', error);
    process.exit(1);
  });
}

export { testAmpsConnection };

