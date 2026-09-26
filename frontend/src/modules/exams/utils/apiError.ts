/**
 * Pulls the backend's own message out of a failed request body so the
 * teacher sees the Spanish explanation (e.g. section/rubric weight sums)
 * instead of axios' generic "Request failed with status code 400".
 *
 * Zod validation errors (see exam-service's `validateRequest` middleware)
 * put the useful text in `errors[0].message`; other rejections (e.g. an
 * `AppError` from the service layer) put it directly in `message`.
 *
 * Shared by `useExams` and `useRubrics` so both hooks surface the real
 * server error instead of a generic fallback.
 */
export const getApiErrorMessage = (body: unknown, fallback: string): string => {
  if (body && typeof body === 'object') {
    const { message, errors } = body as { message?: unknown; errors?: Array<{ message?: unknown }> };
    const detail = Array.isArray(errors) ? errors[0]?.message : undefined;
    if (typeof detail === 'string' && detail) return detail;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
};
