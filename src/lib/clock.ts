/**
 * Request time for Server Components. They render once per request (the pages using this are
 * `force-dynamic`), so reading the clock here is the request's own timestamp, not a render impurity.
 */
export function requestTime() {
  return Date.now();
}
