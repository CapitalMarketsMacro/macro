/**
 * RxJS Conflation Utilities
 * 
 * This library provides conflation utilities for RxJS observables.
 * Based on: https://github.com/angular-fintech/Conflation/blob/main/ConflationJavaScript/apps/ConflationJS/src/main.ts
 * 
 * Conflation is a technique to reduce the frequency of updates by batching
 * multiple updates over a time interval, keeping only the latest value for each key.
 */

import { interval, Observable, Subject, Subscription } from 'rxjs';

/**
 * Represents a conflated value with a key and value
 */
export interface ConflatedValue<TKey = string, TValue = unknown> {
  key: TKey;
  value: TValue;
}

/**
 * Conflates values by key over a specified interval.
 * 
 * This function takes a source observable that emits objects with a key and value,
 * and returns an observable that emits conflated values at regular intervals.
 * Only the latest value for each key is kept and emitted.
 * 
 * @param source$ - The source observable emitting objects with a key and value
 * @param intervalMs - The interval in milliseconds to emit conflated values
 * @returns An observable that emits conflated values by key
 * 
 * @example
 * ```typescript
 * const subject = new Subject<{ key: string, value: number }>();
 * const conflated$ = conflateByKey(subject, 1000);
 * 
 * conflated$.subscribe(value => {
 *   console.log('Conflated value:', value);
 * });
 * 
 * // Emit multiple values rapidly
 * subject.next({ key: 'Key1', value: 1 });
 * subject.next({ key: 'Key1', value: 2 });
 * subject.next({ key: 'Key2', value: 3 });
 * 
 * // After 1 second, will emit:
 * // { key: 'Key1', value: 2 }  (only latest value for Key1)
 * // { key: 'Key2', value: 3 }
 * ```
 */
export function conflateByKey<TKey = string, TValue = unknown>(
  source$: Observable<ConflatedValue<TKey, TValue>>,
  intervalMs: number
): Observable<ConflatedValue<TKey, TValue>> {
  return new Observable<ConflatedValue<TKey, TValue>>(observer => {
    const buffer1 = new Map<TKey, TValue>();
    const buffer2 = new Map<TKey, TValue>();
    let currentBuffer = buffer1;

    const sourceSub = source$.subscribe(({ key, value }) => {
      currentBuffer.set(key, value);
    });

    const timerSub = interval(intervalMs).subscribe(() => {
      const oldBuffer = currentBuffer;
      currentBuffer = currentBuffer === buffer1 ? buffer2 : buffer1;

      for (const [key, value] of oldBuffer.entries()) {
        observer.next({ key, value });
      }
      oldBuffer.clear();
    });

    return () => {
      sourceSub.unsubscribe();
      timerSub.unsubscribe();
    };
  });
}

/**
 * A Subject that automatically conflates values by key.
 * 
 * This class extends Subject and provides automatic conflation of values
 * based on keys. Values are conflated at regular intervals, keeping only
 * the latest value for each key.
 * 
 * @example
 * ```typescript
 * const conflatedSubject = new ConflationSubject<string, number>(1000);
 * 
 * // Subscribe to conflated values
 * conflatedSubject.conflated$.subscribe(value => {
 *   console.log('Conflated value:', value);
 * });
 * 
 * // Emit values (they will be conflated)
 * conflatedSubject.next({ key: 'Key1', value: 1 });
 * conflatedSubject.next({ key: 'Key1', value: 2 });
 * conflatedSubject.next({ key: 'Key2', value: 3 });
 * 
 * // After 1 second, conflated$ will emit:
 * // { key: 'Key1', value: 2 }
 * // { key: 'Key2', value: 3 }
 * ```
 */
export class ConflationSubject<TKey = string, TValue = unknown> extends Subject<ConflatedValue<TKey, TValue>> {
  private conflated$: Observable<ConflatedValue<TKey, TValue>>;
  private subscription?: Subscription;

  /**
   * Creates a new ConflationSubject
   * 
   * @param intervalMs - The interval in milliseconds to emit conflated values
   */
  constructor(intervalMs: number) {
    super();
    this.conflated$ = conflateByKey(this.asObservable(), intervalMs);
  }

  /**
   * Subscribe to the conflated values
   * 
   * @param observerOrNext - Observer or next callback
   * @param error - Error callback
   * @param complete - Complete callback
   * @returns Subscription
   */
  subscribeToConflated(
    observerOrNext?: ((value: ConflatedValue<TKey, TValue>) => void) | Partial<{
      next: (value: ConflatedValue<TKey, TValue>) => void;
      error: (error: unknown) => void;
      complete: () => void;
    }>,
    error?: (error: unknown) => void,
    complete?: () => void
  ): Subscription {
    if (typeof observerOrNext === 'function') {
      return this.conflated$.subscribe(observerOrNext, error, complete);
    } else if (observerOrNext) {
      return this.conflated$.subscribe(observerOrNext);
    } else {
      return this.conflated$.subscribe();
    }
  }

  /**
   * Get the conflated observable
   * 
   * @returns Observable that emits conflated values
   */
  getConflatedObservable(): Observable<ConflatedValue<TKey, TValue>> {
    return this.conflated$;
  }

  /**
   * Automatically subscribe to conflated values and forward them to a subject
   * 
   * @param targetSubject - The subject to forward conflated values to
   * @returns Subscription that can be used to unsubscribe
   */
  pipeToSubject(targetSubject: Subject<ConflatedValue<TKey, TValue>>): Subscription {
    this.subscription = this.conflated$.subscribe(value => {
      targetSubject.next(value);
    });
    return this.subscription;
  }

  /**
   * Unsubscribe from conflated values if a subscription exists
   */
  unsubscribeFromConflated(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
  }

  /**
   * Complete the subject and clean up subscriptions
   */
  override complete(): void {
    this.unsubscribeFromConflated();
    super.complete();
  }

  /**
   * Unsubscribe and clean up
   */
  override unsubscribe(): void {
    this.unsubscribeFromConflated();
    super.unsubscribe();
  }
}

