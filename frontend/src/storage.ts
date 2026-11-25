const LAST_ID_KEY = 'heraap:last-registro-id';

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readLastId(storage = browserStorage()): string {
  try {
    return storage?.getItem(LAST_ID_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function rememberId(id: string, storage = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(LAST_ID_KEY, id);
    return true;
  } catch {
    return false;
  }
}
