/**
 * # promisemitter
 *
 * An observer / event emitter implementation with promise support.
 *
 * Its meant to behave similarly to typical synchronous
 * [Java / NET observers](https://msdn.microsoft.com/en-us/library/ff648108.aspx),
 * where once you notify your subscribers you are able to wait for their update
 * functions to execute before proceeding
 *

# Example

Given a blog post creator:

```typescript
import po = require('promise-observer')

class BlogPostCreator {
    postCreated = po.create();

    create(blogPost) {
      actuallyCreateBlogpost()
        .then(post => this.postCreated.emit(post))
        // wait for all attached events to complete before commiting.
        .then(commitTransaction);
    }
}

```

a categorizer can attach to its events

```typescript
postCategorized = blogPostCreator.postCreated.subscribe(post =>
  categorize(post).then(saveCategory).thenReturn(post));
```

an indexer can add search terms to the index for that post

```typescript
postIndexed = blogPostCreator.postCreated.subscribe(post =>
  index(post).then(saveIndex).thenReturn(post));
```

Then, the email notification system can wait for the post to be
categorized and indexed before sending a notification to all subscribers:

```typescript
onPostNotification = blogPostCreator.postCreated.subscribe(post => {
  var categorized = postCategorized.next(categorizedPost => categorizedPost.id == post.id);
  var indexed = postIndexed.next(indexedPost => indexedPost.id == post.id);
  return Promise.join(categorized, indexed, _ => sendEmailNotification(post))
});
```

 */

import * as helpers from './helpers';

export interface Observable<T> {
  /**
   * Add an async listener. The observer will wait for its promise to complete before continuing
   */
  <U>(listener: (t: T) => Promise<U>): LinkedObservable<U>;
  /**
   * Add a sync listener.
   */
  <U>(listener: (t: T) => U): LinkedObservable<U>;
  /**
   * Wait for the next event that matches the given predicate (no timeout)
   * @param predicate the predicate to use
   */
  next(predicate?: (t: T) => boolean): Promise<T>;
  /**
   * Remove a subscriber (linked observable)
   * @param o the subscriber (linked observable) to remove
   */
  remove<U>(o: Observable<U>): void;
}

export interface Emitter<T> {
  /**
   * Use the emit method to notify all subscribers of new events.
   * It returns a promise that resolves when all subscribers and their dependents finish processing
   * the event.
   * @param data data to emit
   */
  emit(data:T): Promise<void>
  /**
   * Listen to events on this emitter
   */
  subscribe: Observable<T>
}

/**
 * A linked observable, derived by subscribing to a regular observable
 */
export interface LinkedObservable<T> extends Observable<T> {
  /**
   * Stop listening for events. Equivalent to parentObservable.remove(this)
   */
  unlink(): void;
}

export interface Options {
  /**
   * How long to wait for subscribes before throwing a TimeoutError
   */
  emitTimeout?: number;
}

export class TimeoutError extends Error {
  /**
   * Stringified code of the listener that threw the error
   */
  timedoutListener: string = '<unknown>'
}

function timeout<T>(p: Promise<T>, delay: number): Promise<T> {
  let e = new TimeoutError('Timeout waiting for event listener to complete');
  let timeout = new Promise((_, rej) =>
    setTimeout(() => {
      rej(e);
    }, delay)
  );

  return Promise.race([timeout, p]) as Promise<T>;
}


interface Subscription<T, U> {
  emit(t: T): Promise<U> | U;
  target: Observable<U>;
  listener?: (t: T) => U | Promise<U>;
}

/**
 *
 * Creates a new emitter. The emitter contains emit and subscribe methods. The subscribe method
 * is also an `Observable<T>`
 * @param opts - Creation options
 */
export function create<T>(opts?: Options): Emitter<T> {
  opts = opts || {};
  var subscriptions: Array<Subscription<T, any>> = [];

  function emit(t: T) {
    opts = opts || {};
    var results: any[] = [];

    for (var k = 0; k < subscriptions.length; k) {
      var current = subscriptions[k];
      var emitPromise = Promise.resolve(current.emit(t));
      if (opts.emitTimeout != null)
        emitPromise = timeout(emitPromise, opts.emitTimeout).catch(e => {
          if (e.timedoutListener === '<unknown>')
            e.timedoutListener = String(current.listener);
          throw e;
        });
      results.push(emitPromise);
      if (current === subscriptions[k]) ++k;
    }

    return helpers.waitAll(results);
  }

  function next(predicate: (t: T) => boolean) {
    return new Promise<T>((resolve: (t: T) => void) => {
      var sub = subscribe(item => {
        if (predicate == null || predicate(item)) {
          remove(sub);
          resolve(item);
        }
      });
    });
  }
  function subscribe<U>(listener: (t: T) => U): LinkedObservable<U>;
  function subscribe<U>(listener: (t: T) => Promise<U>): LinkedObservable<U> {

    let emitter = create<U>()

    let sub = emitter.subscribe as LinkedObservable<U>

    subscriptions.push({
      emit: item => Promise.resolve(listener(item)).then(emitter.emit),
      target: sub,
      listener: listener
    });

    sub.unlink = () => remove(sub);
    return sub;
  }

  function remove<U>(target: LinkedObservable<U>) {
    for (var k = 0; k < subscriptions.length; ++k)
      if (subscriptions[k].target == target) return subscriptions.splice(k, 1);
  }
  return {emit, subscribe: Object.assign(subscribe, {remove, next})};

}
