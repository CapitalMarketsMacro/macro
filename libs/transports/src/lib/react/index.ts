import { useRef, useEffect, useState, useCallback } from 'react';
import type { Observable } from 'rxjs';
import type { TransportClient, TransportMessage, MessageHandler } from '../transport';
import { AmpsTransport } from '../amps/amps-transport';
import { SolaceTransport } from '../solace/solace-transport';
import { NatsTransport } from '../nats/nats-transport';
import type { AmpsConnectionOptions } from '../amps/amps-transport';
import type { SolaceConnectionOptions } from '../solace/solace-transport';
import type { NatsConnectionOptions } from '../nats/nats-transport';

/**
 * Generic hook that manages a transport client lifecycle.
 * Handles connect, disconnect, and cleanup on unmount.
 */
function useTransport<T extends TransportClient>(
  factory: () => T,
): { client: T; connected: boolean; connect: (options: any) => Promise<void>; disconnect: () => Promise<void> } {
  const clientRef = useRef<T>(factory());
  const [connected, setConnected] = useState(false);

  const connect = useCallback(async (options: any) => {
    await clientRef.current.connect(options);
    setConnected(true);
  }, []);

  const disconnect = useCallback(async () => {
    await clientRef.current.disconnect();
    setConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current.disconnect().catch(() => {});
    };
  }, []);

  return { client: clientRef.current, connected, connect, disconnect };
}

/**
 * React hook for AMPS transport.
 *
 * @example
 * ```tsx
 * const { client, connected, connect } = useAmpsTransport('my-app');
 * useEffect(() => { connect({ url: 'ws://localhost:9100/amps/json' }); }, []);
 * ```
 */
export function useAmpsTransport(clientName?: string) {
  return useTransport(() => new AmpsTransport(clientName));
}

/**
 * React hook for Solace transport.
 *
 * @example
 * ```tsx
 * const { client, connected, connect } = useSolaceTransport();
 * useEffect(() => { connect({ hostUrl: 'ws://localhost:8008', vpnName: 'default', userName: 'user', password: 'pass' }); }, []);
 * ```
 */
export function useSolaceTransport() {
  return useTransport(() => new SolaceTransport());
}

/**
 * React hook for NATS transport.
 *
 * @example
 * ```tsx
 * const { client, connected, connect } = useNatsTransport('my-app');
 * useEffect(() => { connect({ servers: 'ws://localhost:8224' }); }, []);
 * ```
 */
export function useNatsTransport(clientName?: string) {
  return useTransport(() => new NatsTransport(clientName));
}

/**
 * Hook to subscribe to a transport topic and receive messages as state.
 * Manages subscription lifecycle automatically.
 *
 * @example
 * ```tsx
 * const { client } = useNatsTransport();
 * const messages = useTransportSubscription(client, 'prices.>', connected);
 * ```
 */
export function useTransportSubscription(
  client: TransportClient,
  topic: string,
  isConnected: boolean,
  maxMessages = 100,
): TransportMessage[] {
  const [messages, setMessages] = useState<TransportMessage[]>([]);
  const subIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected || !topic) return;

    let cancelled = false;
    (async () => {
      const { observable, subscriptionId } = await client.subscribeAsObservable(topic);
      if (cancelled) { await client.unsubscribe(subscriptionId); return; }
      subIdRef.current = subscriptionId;
      const sub = observable.subscribe((msg) => {
        setMessages((prev) => [msg, ...prev].slice(0, maxMessages));
      });
      // Store cleanup
      return () => { sub.unsubscribe(); };
    })();

    return () => {
      cancelled = true;
      if (subIdRef.current) {
        client.unsubscribe(subIdRef.current).catch(() => {});
        subIdRef.current = null;
      }
    };
  }, [client, topic, isConnected, maxMessages]);

  return messages;
}
