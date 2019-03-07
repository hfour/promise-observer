# promisemitter

An observer implementation with promise support.

Its meant to behave similarly to typical synchronous
[Java / NET observers](https://msdn.microsoft.com/en-us/library/ff648108.aspx),
where once you notify your subscribers you are able to wait for their update
functions to execute before proceeding

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

# API


### po.create():Emitter

`po.create<T>():Emitter<T>`

Creates a new emitter. The emitter contains emit and subscribe methods. The subscribe method
is also an `Observable<T>`


```typescript
interface Emitter<T> {
    emit(t: T): Promise<void>;
    subscribe: Observable<T>;
}
```

Use the emit method to notify all subscribers of new events.

The emit function returns a promise that resolves when all subscribers and
their dependents finish processing the event.

### Observable<T>

The observable is a the part of the emitter where consumers can attach and remove event
subscriptions, without being able to emit new events.

```typescript
interface Observable<T> {
    <U>(listener: (t: T) => U): LinkedObservable<U>;
    <U>(listener: (t: T) => Promise<U>): LinkedObservable<U>;
    next(predicate?: (t: T) => boolean): Promise<T>;
    remove<U>(o: Observable<U>): void;
}
```

#### observer(listener):LinkedObservable

Creates a listener for the observer. A listener is a mapping function that returns
either a new value or a promise.

Returns a linked observable  that emits whenever the returned  promises or values
resolve.

#### observer.next(predicate?):Promise

Waits for the next event that satisfies the specified predicate. Returns a
promise for the value contained in that event.

The predicate is optional.

#### observer.remove(linkedObservable)

Removes a listener (linked observable).

### linkedObservable.unlink()

Same as `parentObservable.remove(linkedObservable)`

# License

MIT

