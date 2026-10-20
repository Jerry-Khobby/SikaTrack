import type { ApiProblem } from './types';

/** An error response from the API, with what the app needs to show and trace it. */
export class ApiError extends Error {
  status: number;
  code: string;
  detail?: string;
  /** `X-Request-ID`, shown on error screens as "Ref: …". */
  requestId?: string;
  /** Seconds from `Retry-After` on `rate_limited`. */
  retryAfter?: number;

  constructor(problem: ApiProblem, requestId?: string, retryAfter?: number) {
    super(problem.title ?? problem.code);
    this.status = problem.status;
    this.code = problem.code;
    this.detail = problem.detail;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
  }
}
