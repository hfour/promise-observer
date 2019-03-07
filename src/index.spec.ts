import * as observer from './index';
import 'jest';

function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time));
}

describe('observer', () => {
  it('basic', async () => {
    let values: number[] = [];
    var numbers = observer.create<number>();

    var singleIncrement = numbers.subscribe(async function(val) {
      await delay(1);
      return val + 1;
    });
    var doubleIncrement = numbers.subscribe(async function(val) {
      await singleIncrement.next();
      return val + 2;
    });
    var push = values.push.bind(values);
    singleIncrement(push);
    doubleIncrement(push);
    return numbers.emit(0).then(() => expect(values).toEqual([1, 2]));
  });

  function any() {
    return true;
  }

  it('two nexts', function twoNexts() {
    async function derived1(val: number) {
      await delay(1);
      return val + 1;
    }
    function plus1(val: number) {
      return val + 1;
    }
    var numbers = observer.create<number>({ emitTimeout: 25 });
    var derived2 = numbers.subscribe(derived1);
    var third = numbers.subscribe(async function waiter() {

      await derived2.next(any);
    });
    var fourth = numbers.subscribe(async function waiter2() {

      await derived2.next(any);
    });
    return Promise.all([numbers.emit(0), third.next(), fourth.next()]);
  });

  it('timeouts', async function timeouts() {
    var onNumber = observer.create<number>({ emitTimeout: 10 });
    function slow() {
      onNumber.subscribe(function slow() {
        return delay(50);
      });
    }

    function fast() {
      onNumber.subscribe(function fast() {
        return delay(1);
      });
    }
    fast();
    slow();

    try {
      return await onNumber.emit(0);
    }
    catch (e) {
      expect(e.timedoutListener.indexOf('slow')).toBeGreaterThanOrEqual(0);
    }
  });

  it('cycles', async function() {
    var numbers = observer.create<number>({ emitTimeout: 10 });
    var increments = numbers.subscribe(val => delay(1).then(() => val + 1));
    var on3 = increments(val => delay(1).then(() => numbers.emit(val + 1)));

    try {
      return await numbers.emit(0);
    }
    catch (e) {
      return expect(e).toBeTruthy();
    }
  });
});
