// Shared, explicit "this is a client-facing error with a known status code"
// class. Routes throw this for expected failure cases (not found, validation,
// business-rule violation, etc). Anything that is NOT an HttpError is treated
// by the global error handler as an unexpected internal error and is never
// echoed back to the client verbatim (see index.js).
export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}