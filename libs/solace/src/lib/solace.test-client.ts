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

async function testSolaceConnection() {
  console.log('Creating Solace client...');
  const client = new SolaceClient({ logLevel: 'INFO' });

  // Set up event handlers before connecting
  client.eventHandler((event, details) => {
    console.log(`📡 Event: ${event}`, details ? JSON.stringify(details) : '');
  });

  client.errorHandler((error) => {
    console.error('❌ Error:', error.message);
  });

  try {
    console.log('Connecting to Solace Cloud...');
    await client.connect({
      hostUrl: 'wss://mr-connection-q5agmcv5edb.messaging.solace.cloud:443',
      vpnName: 'MACRO',
      userName: 'solace-cloud-client',
      password: 'fhr8ncq2h9jsvnjb2s4ppmnngh',
    });

    console.log('✓ Successfully connected to Solace Cloud!');

    // Test subscribing to a topic
    console.log('\nSubscribing to test topic...');
    const { observable, subscriptionId } = await client.subscribeAsObservable('test/topic');

    console.log(`✓ Subscribed to 'test/topic' with subscription ID: ${subscriptionId}`);

    // Listen for messages
    const subscription = observable.subscribe({
      next: (message) => {
        console.log('📨 Received message:', {
          destination: message.getDestination()?.getName(),
          data: message.getBinaryAttachment(),
          correlationId: message.getCorrelationId(),
        });
        const data = message.getBinaryAttachment();
        // convert data from ArrayBuffer to string
        const decoder = new TextDecoder('utf-8');
        // @ts-ignore
        const messageString = decoder.decode(data);
        console.log('📝 Message content:', messageString);
      },
      error: (error) => {
        console.error('❌ Subscription error:', error);
      },
      complete: () => {
        console.log('✓ Subscription completed');
      },
    });

    // Test publishing a message
    console.log('\nPublishing test message...');
    client.publish('test/topic', { message: 'Hello from SolaceClient test!', timestamp: Date.now() }, {correlationId: subscriptionId});
    console.log('✓ Message published');

    // Keep connection alive for a bit to receive messages
    console.log('\nWaiting for messages (press Ctrl+C to exit)...');
    console.log('Connection will stay open for 30 seconds...\n');

    // Wait for 30 seconds then disconnect
    setTimeout(async () => {
      console.log('\nDisconnecting...');
      subscription.unsubscribe();
      await client.unsubscribe(subscriptionId);
      await client.disconnect();
      console.log('✓ Disconnected successfully');
      process.exit(0);
    }, 30000);

  } catch (error) {
    console.error('❌ Connection failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testSolaceConnection().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export { testSolaceConnection };

