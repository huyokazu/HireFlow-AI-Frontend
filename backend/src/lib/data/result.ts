type QueryResult = { data: unknown; error: unknown };

/** The rows of a list query; throws its error. PostgREST returns `[]`, never null, on success. */
export function rowsOf<R extends QueryResult>(result: R): NonNullable<R['data']> {
  if (result.error) throw result.error;
  return (result.data ?? []) as NonNullable<R['data']>;
}

/** The row an insert or `.single()` returned; throws its error. */
export function rowOf<R extends QueryResult>(result: R): NonNullable<R['data']> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined) throw new Error('Expected a row, got none');
  return result.data as NonNullable<R['data']>;
}
