/*********************************************************************
 *                   BiDirectionalMap                                *
 * Reusable with all functionality of JavaScript Map<T,T>()               *
 * - Requires single type for cross referencing                      *
 * - Required all keys and values to be unique for cross referencing *
 *********************************************************************/

export default class BiDirectionalMap<T> {
    private keyToValueMap:Map<T,T> = new Map<T,T>();
    private valueToKeyMap:Map<T,T> = new Map<T,T>();

      constructor(entries?:Iterable<[T, T]>) {
      if(entries) {
        for (const [key, value] of entries) {
            this.set(key, value);
          }
      }
    }

    equals = (a: T, b: T): boolean => JSON.stringify(a) === JSON.stringify(b);

    get size():number { return this.keyToValueMap.size; }
  
    set = (key:T, value:T):this => {
      if(key === undefined || key === null || value === undefined || value === null)
        throw new Error(`BiDirectionalMap | undefined and null are not supported: ${key} , ${value}`);
      else if(this.has(key) || this.has(value)) //Checks both internal maps for unique value
        throw new Error(`BiDirectionalMap | Duplicate key or value detected, which could lead to circular references: ${key} , ${value}`);
  
      this.keyToValueMap.set(key, value);
      this.valueToKeyMap.set(value, key);
      return this;
    };

    getByKey = (key:T):T|undefined => this.keyToValueMap.get(key);
  
    getByValue = (value:T):T|undefined => this.valueToKeyMap.get(value);

    get = (keyOrValue:T): T|undefined => this.getByKey(keyOrValue) ?? this.getByValue(keyOrValue);

    hasByKey = (key:T):boolean => this.keyToValueMap.has(key);

    hasByValue = (value:T):boolean => this.valueToKeyMap.has(value);
  
    has = (keyOrValue:T):boolean => this.hasByKey(keyOrValue) || this.hasByValue(keyOrValue);
  
    deleteByKey = (key:T):boolean => {
      if (this.hasByKey(key)) {
        this.valueToKeyMap.delete(this.getByKey(key));
        this.keyToValueMap.delete(key);
        return true;
      }
      return false;
    };
  
    deleteByValue = (value:T):boolean => {
      if (this.hasByValue(value)) {
        this.keyToValueMap.delete(this.getByValue(value));
        this.valueToKeyMap.delete(value);
        return true;
      }
      return false;
    };

    delete = (keyOrValue:T):boolean => this.deleteByKey(keyOrValue) || this.deleteByValue(keyOrValue);
  
    clear = ():void => {
      this.keyToValueMap.clear();
      this.valueToKeyMap.clear();
    }; 

    keys = ():IterableIterator<T> => this.keyToValueMap.keys();
  
    values = ():IterableIterator<T> => this.keyToValueMap.values();
  
    entries = ():IterableIterator<[T,T]> => this.keyToValueMap.entries();
  
    forEach = (callbackfn: (value:T, key:T, map: Map<T,T>) => void, thisArg?: any): void =>
    this.keyToValueMap.forEach((value, key) => callbackfn.call(thisArg, value, key, this));  
  }
