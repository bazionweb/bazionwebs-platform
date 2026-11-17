import { useSyncExternalStore } from "react";

export type StateCreator<T> = (
  set: (partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean) => void,
  get: () => T
) => T;

export interface StoreApi<T> {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean) => void;
  subscribe: (listener: () => void) => () => void;
}

export type UseBoundStore<T> = {
  (): T;
  <U>(selector: (state: T) => U): U;
} & StoreApi<T>;

function createStoreImpl<T>(creator: StateCreator<T>): UseBoundStore<T> {
  let state: T;
  const listeners = new Set<() => void>();

  const setState: StoreApi<T>["setState"] = (partial, replace) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    if (!Object.is(nextState, state)) {
      state = replace ? (nextState as T) : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener());
    }
  };

  const getState: StoreApi<T>["getState"] = () => state;
  const subscribe: StoreApi<T>["subscribe"] = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  state = creator(setState, getState);

  function useBoundStore(): T;
  function useBoundStore<U>(selector: (s: T) => U): U;
  function useBoundStore<U>(selector?: (s: T) => U) {
    const select = selector ?? ((s: T) => s as unknown as U);
    return useSyncExternalStore(
      subscribe,
      () => select(state),
      () => select(state)
    );
  }

  return Object.assign(useBoundStore, { getState, setState, subscribe }) as UseBoundStore<T>;
}

export function create<T>(creator: StateCreator<T>): UseBoundStore<T>;
export function create<T>(): <U extends T>(creator: StateCreator<U>) => UseBoundStore<U>;
export function create<T>(creator?: StateCreator<T>): any {
  if (creator) return createStoreImpl(creator);
  return (deferredCreator: any) => createStoreImpl(deferredCreator);
}
