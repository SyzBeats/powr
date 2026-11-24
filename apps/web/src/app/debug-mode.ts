const DEBUG_KEY = 'powr.debug';

/** `?debug=1` turns developer tools on for this device, `?debug=0` turns them off (§8.17). */
export function resolveDebugMode(search: string): boolean {
  const flag = new URLSearchParams(search).get('debug');
  try {
    if (flag === '1') localStorage.setItem(DEBUG_KEY, '1');
    if (flag === '0') localStorage.removeItem(DEBUG_KEY);
    return localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return flag === '1';
  }
}
