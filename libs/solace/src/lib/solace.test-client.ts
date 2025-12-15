/**
 * Test client for Solace PubSub+ connection
 *
 * This is a test/demo client that connects to Solace Cloud.
 * Run this file to test the SolaceClient implementation.
 *
 * Usage:
 *   - For Node.js: ts-node libs/solace/src/lib/solace.test-client.ts
 *   - Or compile and run: node dist/libs/solace/src/lib/solace.test-client.js
 */

import { SolaceClient } from './solace';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('SolaceTestClient');

async function testSolaceConnection() {
  logger.info('Creating Solace client...');
  const client = new SolaceClient({ logLevel: 'INFO' });

  // Set up event handlers before connecting
  client.eventHandler((event, details) => {
    logger.info(`Event: ${event}`, details || {});
  });

  client.errorHandler((error) => {
    logger.error('Error', { message: error.message });
  });

  try {
    logger.info('Connecting to Solace Cloud...');
    await client.connect({
      hostUrl: 'wss://mr-connection-q5agmcv5edb.messaging.solace.cloud:443',
      vpnName: 'MACRO',
      userName: 'solace-cloud-client',
      password: 'fhr8ncq2h9jsvnjb2s4ppmnngh',
    });

    logger.info('Successfully connected to Solace Cloud!');

    // Test subscribing to a topic
    logger.info('Subscribing to test topic...');
    const { observable, subscriptionId } = await client.subscribeAsObservable('test/topic');

    logger.info(`Subscribed to 'test/topic' with subscription ID: ${subscriptionId}`);

    // Listen for messages
    const subscription = observable.subscribe({
      next: (message) => {
        const data = message.getBinaryAttachment();
        // convert data from ArrayBuffer to string
        const decoder = new TextDecoder('utf-8');
        // @ts-ignore
        const messageString = decoder.decode(data);
        logger.info('Received message', {
          destination: message.getDestination()?.getName(),
          correlationId: message.getCorrelationId(),
          content: messageString,
        });
      },
      error: (error) => {
        logger.error('Subscription error', error);
      },
      complete: () => {
        logger.info('Subscription completed');
      },
    });

    // Test publishing a message
    logger.info('Publishing test message...');
    client.publish('test/topic', { message: 'Hello from SolaceClient test!', timestamp: Date.now() }, {correlationId: subscriptionId});
    logger.info('Message published');

    // Keep connection alive for a bit to receive messages
    logger.info('Waiting for messages (press Ctrl+C to exit)...');
    logger.info('Connection will stay open for 30 seconds...');

    // Wait for 30 seconds then disconnect
    setTimeout(async () => {
      logger.info('Disconnecting...');
      subscription.unsubscribe();
      await client.unsubscribe(subscriptionId);
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
  testSolaceConnection().catch((error) => {
    logger.error('Test failed', error);
    process.exit(1);
  });
}

export { testSolaceConnection };

