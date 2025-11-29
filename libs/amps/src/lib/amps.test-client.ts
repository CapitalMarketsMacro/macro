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

async function testAmpsConnection() {
  console.log('Creating AMPS client...');
  const client = new AmpsClient('amps-test-client');

  // Set up error handler before connecting
  client.errorHandler(async (error) => {
    console.error('❌ AMPS Error:', error.message);
    if (error.stack) {
      console.error('Error stack:', error.stack);
    }
  });

  try {
    console.log('Connecting to AMPS server...');
    const ampsUrl = 'ws://MontuNobleNumbat2404:9008/amps/json';
    await client.connect(ampsUrl);

    console.log('✓ Successfully connected to AMPS server!');

    // Test subscribing to a topic
    console.log('\nSubscribing to test topic...');
    const { observable, subId } = await client.subscribeAsObservable('test/topic');

    console.log(`✓ Subscribed to 'test/topic' with subscription ID: ${subId}`);

    // Listen for messages
    const subscription = observable.subscribe({
      next: (message) => {
        console.log('📨 Received message:', {
          topic: message.topic,
          subId: message.subId,
          sequence: message.sequence,
        });
        
        // Display message data
        if (typeof message.data === 'string') {
          console.log('📝 Message content (string):', message.data);
        } else {
          console.log('📝 Message content (object):', JSON.stringify(message.data, null, 2));
        }
        
        // Display header if available
        if (message.header) {
          console.log('📋 Message header command:', message.header.command?.());
        }
      },
      error: (error) => {
        console.error('❌ Subscription error:', error);
      },
      complete: () => {
        console.log('✓ Subscription completed');
      },
    });

    // Test publishing 5 messages
    console.log('\nPublishing 5 test messages...');
    for (let i = 1; i <= 5; i++) {
      client.publish('test/topic', { 
        message: `Hello from AmpsClient test! Message #${i}`,
        messageNumber: i,
        timestamp: Date.now(),
        clientName: 'amps-test-client'
      });
      console.log(`✓ Message ${i}/5 published`);
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('✓ All 5 messages published');

    // Keep connection alive for a bit to receive messages
    console.log('\nWaiting for messages (press Ctrl+C to exit)...');
    console.log('Connection will stay open for 30 seconds...\n');

    // Wait for 30 seconds then disconnect
    setTimeout(async () => {
      console.log('\nDisconnecting...');
      subscription.unsubscribe();
      await client.unsubscribe(subId);
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
  testAmpsConnection().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export { testAmpsConnection };

