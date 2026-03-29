/**
 * Query rates/executions from AMPS SOW
 * Run: npx tsx scripts/amps-query-executions.ts
 */
import { Client } from 'amps';

const AMPS_URL = 'ws://montunoblenumbat2404:9008/amps/json';
const TOPIC = 'rates/executions';
const CLIENT_NAME = 'query-executions';
const TOP_N = 10;

async function queryExecutions() {
  const client = new Client(CLIENT_NAME);

  console.log(`Connecting to ${AMPS_URL}...`);

  try {
    await client.connect(AMPS_URL);
    console.log('Connected to AMPS');

    const messages: unknown[] = [];

    console.log(`Querying SOW for topic: ${TOPIC}`);

    await client.sow(
      (message: unknown) => {
        const msg = message as { c?: string; data?: unknown };
        if (msg.c === 'sow') {
          messages.push(msg.data);
        } else if (msg.c === 'group_begin') {
          console.log('SOW query started...');
        } else if (msg.c === 'group_end') {
          console.log('SOW query complete.');
        }
      },
      TOPIC
    );

    console.log(`\n=== Total: ${messages.length} executions (showing top ${TOP_N}) ===\n`);

    if (messages.length === 0) {
      console.log('No executions found in SOW. The topic may be empty.');
    } else {
      messages.slice(0, TOP_N).forEach((msg, idx) => {
        console.log(`\n--- Execution ${idx + 1} ---`);
        console.log(JSON.stringify(msg, null, 2));
      });
    }

    await client.disconnect();
    console.log('\nDisconnected from AMPS');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

queryExecutions();
