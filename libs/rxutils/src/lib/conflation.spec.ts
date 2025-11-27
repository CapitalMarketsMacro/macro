import { Subject } from 'rxjs';
import { conflateByKey, ConflationSubject } from './conflation';

describe('conflateByKey', () => {
  it('should conflate values by key', (done) => {
    const source$ = new Subject<{ key: string; value: number }>();
    const conflated$ = conflateByKey(source$, 100);

    const results: Array<{ key: string; value: number }> = [];

    conflated$.subscribe((value) => {
      results.push(value);
    });

    // Emit multiple values rapidly
    source$.next({ key: 'Key1', value: 1 });
    source$.next({ key: 'Key1', value: 2 });
    source$.next({ key: 'Key2', value: 3 });
    source$.next({ key: 'Key1', value: 4 });

    // Wait for conflation interval
    setTimeout(() => {
      expect(results.length).toBeGreaterThan(0);
      // Should only have latest values for each key
      const key1Values = results.filter((r) => r.key === 'Key1');
      const key2Values = results.filter((r) => r.key === 'Key2');

      if (key1Values.length > 0) {
        expect(key1Values[key1Values.length - 1].value).toBe(4);
      }
      if (key2Values.length > 0) {
        expect(key2Values[key2Values.length - 1].value).toBe(3);
      }

      source$.complete();
      done();
    }, 150);
  });

  it('should handle empty source', (done) => {
    const source$ = new Subject<{ key: string; value: number }>();
    const conflated$ = conflateByKey(source$, 50);

    let emitted = false;
    conflated$.subscribe(() => {
      emitted = true;
    });

    source$.complete();

    setTimeout(() => {
      expect(emitted).toBe(false);
      done();
    }, 100);
  });
});

describe('ConflationSubject', () => {
  it('should create and emit conflated values', (done) => {
    const conflatedSubject = new ConflationSubject<string, number>(100);
    const results: Array<{ key: string; value: number }> = [];

    conflatedSubject.subscribeToConflated((value) => {
      results.push(value);
    });

    conflatedSubject.next({ key: 'Key1', value: 1 });
    conflatedSubject.next({ key: 'Key1', value: 2 });
    conflatedSubject.next({ key: 'Key2', value: 3 });

    setTimeout(() => {
      expect(results.length).toBeGreaterThan(0);
      conflatedSubject.complete();
      done();
    }, 150);
  });

  it('should get conflated observable', () => {
    const conflatedSubject = new ConflationSubject<string, number>(100);
    const observable = conflatedSubject.getConflatedObservable();

    expect(observable).toBeDefined();
    expect(typeof observable.subscribe).toBe('function');
  });

  it('should pipe to another subject', (done) => {
    const conflatedSubject = new ConflationSubject<string, number>(100);
    const targetSubject = new Subject<{ key: string; value: number }>();
    const results: Array<{ key: string; value: number }> = [];

    targetSubject.subscribe((value) => {
      results.push(value);
    });

    conflatedSubject.pipeToSubject(targetSubject);

    conflatedSubject.next({ key: 'Key1', value: 1 });
    conflatedSubject.next({ key: 'Key1', value: 2 });

    setTimeout(() => {
      expect(results.length).toBeGreaterThan(0);
      conflatedSubject.complete();
      targetSubject.complete();
      done();
    }, 150);
  });

  it('should clean up on complete', () => {
    const conflatedSubject = new ConflationSubject<string, number>(100);
    const subscription = conflatedSubject.subscribeToConflated(() => {});

    expect(subscription.closed).toBe(false);

    conflatedSubject.complete();

    expect(subscription.closed).toBe(true);
  });

  it('should clean up on unsubscribe', () => {
    const conflatedSubject = new ConflationSubject<string, number>(100);
    const subscription = conflatedSubject.subscribeToConflated(() => {});

    expect(subscription.closed).toBe(false);

    conflatedSubject.unsubscribe();

    expect(subscription.closed).toBe(true);
  });
});

