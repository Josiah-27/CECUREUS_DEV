/**
 * Minimal client for the CecureUs table API:
 *   GET    {base}/{table}        → { status: true, data: Row[] }
 *   GET    {base}/{table}/{id}   → { status: true, data: Row[] }   (empty array when not found)
 *   POST   {base}/{table}        → insert (JSON body)
 *   PUT    {base}/{table}/{id}   → partial update (JSON body)
 *   DELETE {base}/{table}/{id}   → not used by the app
 * Only GET, POST, PUT and DELETE are accepted by the server; query-string filters are ignored.
 */
import type { Row } from './mapping';

export type TableName = 'employee_list' | 'doctor_list' | 'doctor_category' | 'booking_appointment';

/**
 * The only tables the app may touch, with each table's primary key and the only columns that are
 * kept from a response. Everything else (emp_password, emp_otp, doc_password, doc_otp, bank_*,
 * doc_pannumber, doc_mobile, doc_email, start_url, zoom ids …) is dropped the moment a response
 * is parsed, so it never reaches app memory, caches, logs or crash reports.
 * A column the app starts to read must be added here first.
 */
export const TABLES: Record<TableName, { key: string; columns: readonly string[] }> = {
  employee_list: {
    key: 'emp_id',
    columns: [
      'emp_id', 'emp_name', 'emp_lname', 'emp_email', 'emp_mobile', 'emp_option', 'emp_companyname',
      'emp_organisationname', 'emp_age', 'status',
    ],
  },
  doctor_list: {
    key: 'doc_id',
    columns: [
      'doc_id', 'doc_name', 'doc_cityname', 'doc_experiance', 'doc_prelanguage', 'doc_category',
      'doc_description', 'doct_image', 'status',
    ],
  },
  doctor_category: {
    key: 'cat_id',
    columns: ['cat_id', 'category_name', 'parent_category', 'status'],
  },
  booking_appointment: {
    key: 'book_id',
    columns: [
      'book_id', 'customer_id', 'doc_id', 'doc_name', 'service_time', 'issuse_name', 'speaking_language',
      'connectoption', 'booknewdate', 'join_url', 'meating_timelist', 'meating_starttime', 'meating_endtime',
      'status', 'reason', 'canceledby',
    ],
  },
};

/** Row ids are auto-increment integers; anything else is never put into a URL. */
const isRowId = (id: string) => /^[1-9]\d{0,11}$/.test(id);

function assertTable(table: string): asserts table is TableName {
  if (!Object.prototype.hasOwnProperty.call(TABLES, table)) {
    throw new TableApiError(`Table "${table}" is not allowed`);
  }
}

function pick(table: TableName, row: Row): Row {
  const out: Row = {};
  for (const column of TABLES[table].columns) if (column in row) out[column] = row[column];
  return out;
}

export class TableApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'TableApiError';
    this.status = status;
  }
}

export type TableApi = ReturnType<typeof createTableApi>;

export function createTableApi(config: { baseUrl: string; fetchImpl?: typeof fetch }) {
  const base = config.baseUrl.replace(/\/+$/, '');
  const doFetch: typeof fetch = (input, init) => (config.fetchImpl ?? globalThis.fetch)(input, init);

  async function call(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    // Network errors and aborts propagate unchanged so the app reports offline/timeout correctly.
    const res = await doFetch(`${base}/${path}`, {
      method,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    const obj = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
    if (!res.ok || obj.status === false || json === undefined) {
      throw new TableApiError(`${method} ${path} failed (${res.status})`, res.status);
    }
    return obj;
  }

  const rowsOf = (table: TableName, obj: Record<string, unknown>): Row[] => {
    const data = obj.data;
    const rows = Array.isArray(data) ? data : data && typeof data === 'object' ? [data] : [];
    return rows.filter((r): r is Row => !!r && typeof r === 'object' && !Array.isArray(r)).map((r) => pick(table, r));
  };

  return {
    async list(table: TableName, signal?: AbortSignal): Promise<Row[]> {
      assertTable(table);
      return rowsOf(table, await call('GET', table, undefined, signal));
    },
    async get(table: TableName, id: string, signal?: AbortSignal): Promise<Row | null> {
      assertTable(table);
      if (!isRowId(id)) return null;
      const rows = rowsOf(table, await call('GET', `${table}/${id}`, undefined, signal));
      // Only accept the row that was asked for, whatever the server sends back.
      return rows.find((r) => String(r[TABLES[table].key]) === id) ?? null;
    },
    /** Returns the raw response; the inserted id is read from it when the server includes one. */
    async create(table: TableName, row: Row, signal?: AbortSignal): Promise<Record<string, unknown>> {
      assertTable(table);
      return call('POST', table, row, signal);
    },
    async update(table: TableName, id: string, patch: Row, signal?: AbortSignal): Promise<void> {
      assertTable(table);
      if (!isRowId(id)) throw new TableApiError(`PUT ${table} refused: invalid row id`);
      // The primary key is never part of a patch, so a row cannot be re-keyed.
      const { [TABLES[table].key]: _key, ...safe } = patch;
      await call('PUT', `${table}/${id}`, safe, signal);
    },
  };
}

/** Best-effort extraction of an inserted id from a POST response ({id}, {insert_id}, {data:{book_id}} …). */
export function insertedId(response: Record<string, unknown>, key: string): string | null {
  const candidates = [response, response.data as Record<string, unknown> | undefined];
  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue;
    for (const k of [key, 'id', 'insert_id', 'insertId', 'last_id', 'lastInsertId']) {
      const v = (c as Record<string, unknown>)[k];
      if ((typeof v === 'string' && /^\d+$/.test(v)) || (typeof v === 'number' && v > 0)) return String(v);
    }
  }
  return null;
}
