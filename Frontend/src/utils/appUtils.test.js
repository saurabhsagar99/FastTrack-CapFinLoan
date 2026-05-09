import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiRequest,
  downloadCsv,
  emptyLoanForm,
  emptySession,
  formatDateTime,
  mapDecisionStatusToApplicationStatus,
  normalizeKeys,
  normalizeRole,
  parseJsonSafe,
  parseStatusNoteParts,
  parseStoredSession,
  statusTone,
  unwrapData,
  SESSION_KEY,
} from './appUtils';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe('appUtils', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('normalizes role values consistently', () => {
    expect(normalizeRole(' admin ')).toBe('ADMIN');
    expect(normalizeRole('Applicant')).toBe('APPLICANT');
    expect(normalizeRole()).toBe('');
  });

  it('parses stored session from sessionStorage and returns defaults when missing', () => {
    const stored = { token: 'abc', role: 'admin', name: 'Saurav', userId: 'u1' };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored));

    expect(parseStoredSession()).toEqual(stored);
    sessionStorage.clear();
    expect(parseStoredSession()).toEqual(emptySession);
  });

  it('returns emptySession when stored session JSON is invalid', () => {
    sessionStorage.setItem(SESSION_KEY, '{invalid-json');
    expect(parseStoredSession()).toEqual(emptySession);
  });

  it('parses JSON safely and returns raw text when JSON is invalid', () => {
    expect(parseJsonSafe(null)).toBeNull();
    expect(parseJsonSafe('')).toBeNull();
    expect(parseJsonSafe('{"ok":true}')).toEqual({ ok: true });
    expect(parseJsonSafe('not-json')).toBe('not-json');
  });

  it('normalizes object keys recursively and preserves arrays', () => {
    const input = {
      FirstName: 'Jane',
      Address: { City: 'City', PostalCode: '12345' },
      Items: [{ ItemName: 'book' }],
      '': 'blank',
    };

    expect(normalizeKeys(input)).toEqual({
      firstName: 'Jane',
      address: { city: 'City', postalCode: '12345' },
      items: [{ itemName: 'book' }],
      '': 'blank',
    });
  });

  it('unwraps payload data when data field exists, otherwise returns payload unchanged', () => {
    expect(unwrapData({ data: { id: 1 }, message: 'ok' })).toEqual({ id: 1 });
    const payload = { id: 2 };
    expect(unwrapData(payload)).toEqual(payload);
  });

  it('makes a GET request and returns parsed response payload', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { id: 1 }, message: 'OK' }),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiRequest({ gateway: 'http://api', path: '/status' });

    expect(fetchMock).toHaveBeenCalledWith('http://api/status', {
      method: 'GET',
      headers: {},
      body: undefined,
    });
    expect(result).toEqual({
      ok: true,
      status: 200,
      payload: { data: { id: 1 }, message: 'OK' },
      data: { id: 1 },
      message: 'OK',
      error: '',
    });
  });

  it('sends JSON request body and authorization header when token is provided', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ data: { result: 'created' } }),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const body = { name: 'test' };
    await apiRequest({
      gateway: 'http://api',
      path: '/items',
      method: 'POST',
      token: 'abc123',
      body,
    });

    expect(fetchMock).toHaveBeenCalledWith('http://api/items', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer abc123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  });

  it('supports FormData requests without JSON content type', async () => {
    const fakeForm = new FormData();
    fakeForm.append('field', 'value');
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { ok: true } }),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest({
      gateway: 'http://api',
      path: '/upload',
      method: 'POST',
      body: fakeForm,
      isFormData: true,
    });

    expect(fetchMock).toHaveBeenCalledWith('http://api/upload', {
      method: 'POST',
      headers: {},
      body: fakeForm,
    });
  });

  it('returns error text when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ message: 'Bad request' }),
      }),
    ));

    const result = await apiRequest({ gateway: 'http://api', path: '/error' });
    expect(result.error).toBe('Bad request');
    expect(result.ok).toBe(false);
  });

  it('returns a generic error when non-JSON response text cannot be parsed', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: async () => 'server failure',
      }),
    ));

    const result = await apiRequest({ gateway: 'http://api', path: '/error' });
    expect(result.error).toBe('Request failed');
  });

  it('maps status text to tone values correctly', () => {
    expect(statusTone('approved')).toBe('approved');
    expect(statusTone('REJECTED')).toBe('rejected');
    expect(statusTone('submitted for review')).toBe('pending');
    expect(statusTone('draft state')).toBe('draft');
    expect(statusTone()).toBe('draft');
  });

  it('maps decision statuses to application statuses', () => {
    expect(mapDecisionStatusToApplicationStatus('APPROVED')).toBe('Approved');
    expect(mapDecisionStatusToApplicationStatus('rejected')).toBe('Rejected');
    expect(mapDecisionStatusToApplicationStatus('pending')).toBe('UnderReview');
    expect(mapDecisionStatusToApplicationStatus('unknown')).toBe('Submitted');
    expect(mapDecisionStatusToApplicationStatus()).toBe('Submitted');
  });

  it('formats valid date-time values and returns dash for invalid values', () => {
    const iso = '2025-12-31T18:30:00Z';
    expect(formatDateTime(iso)).toBe(new Date(iso).toLocaleString());
    expect(formatDateTime('not-a-date')).toBe('-');
    expect(formatDateTime()).toBe('-');
  });

  it('parses status note parts from remark and sanction terms text', () => {
    expect(parseStatusNoteParts('')).toEqual({ remark: '', sanctionTerms: '' });
    expect(parseStatusNoteParts('Remark: Approved')).toEqual({ remark: 'Approved', sanctionTerms: '' });
    expect(parseStatusNoteParts('Remark: Accepted | Sanction Terms: 30 days')).toEqual({
      remark: 'Accepted',
      sanctionTerms: '30 days',
    });
    expect(parseStatusNoteParts('Loan approved sanction terms: 45 days')).toEqual({
      remark: 'Loan approved',
      sanctionTerms: '45 days',
    });
  });

  it('escapes CSV cells and downloads CSV content when rows are provided', () => {
    const createObjectURL = vi.fn(() => 'blob:http://fake-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    downloadCsv('test.csv', [[1, 'hello"world'], [2, 'ok']]);

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://fake-url');
  });

  it('does not attempt to download CSV when rows are empty', () => {
    const createObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL: vi.fn(),
    });

    downloadCsv('empty.csv', []);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('exports the emptyLoanForm constant and default session shape', () => {
    expect(emptyLoanForm).toHaveProperty('applicantName', '');
    expect(emptySession).toEqual({ token: '', role: '', name: '', userId: '' });
  });
});
