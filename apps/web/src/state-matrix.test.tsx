import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api, type LockersReply } from './api/client.js';
import { AgentPage } from './routes/AgentPage.js';
import { RetrievePage } from './routes/RetrievePage.js';

vi.mock('./api/client.js', () => ({
  api: { listLockers: vi.fn(), createLocker: vi.fn(), storePackage: vi.fn(), retrievePackage: vi.fn() },
}));
const listLockers = vi.mocked(api.listLockers);
const storePackage = vi.mocked(api.storePackage);
const retrievePackage = vi.mocked(api.retrievePackage);

const station: LockersReply = {
  lockers: [
    { id: 'A1', size: 'SMALL', occupied: false },
    { id: 'A2', size: 'MEDIUM', occupied: true },
  ],
};

function apiError(code: string, status: number): unknown {
  return Object.assign(new Error(code), { code, status });
}

/** Raw AD-7 codes and HTTP digits never reach the customer (voice + tone). */
const RAW_CODE = /NO_SUITABLE_LOCKER|INVALID_PICKUP_CODE|LOCKER_NOT_FOUND|LOCKER_EMPTY|VALIDATION_ERROR|INTERNAL_ERROR/;

/** Drive the store form to a submit. */
async function submitStore(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /small · free/i }));
  await user.click(screen.getByRole('button', { name: /store package/i }));
}

/** Drive the retrieval form to a submit. */
async function submitRetrieve(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/locker id/i), 'clx8m2qk4');
  await user.type(screen.getByLabelText('code character 1'), 'A7BXK9ZM');
  await user.click(screen.getByRole('button', { name: /open my locker/i }));
}

/**
 * Story 4.7 audit: every AD-7 outcome maps to its calm EXPERIENCE.md copy on
 * the right surface, and no raw code or jargon ever leaks into the DOM. This
 * deliberately re-covers the per-story tests — it is the state matrix as one
 * legible contract.
 */
describe('AD-7 state matrix (audit)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe.each([
    ['NO_SUITABLE_LOCKER', 409, 'No free locker fits a SMALL package right now.'],
    ['VALIDATION_ERROR', 400, 'Check this field and try again.'],
    ['INTERNAL_ERROR', 500, 'Something went wrong on our side.'],
  ])('store surface — %s', (code, status, copy) => {
    it(`shows "${copy}" and leaks no raw code`, async () => {
      listLockers.mockResolvedValue(station);
      storePackage.mockRejectedValue(apiError(code, status));
      const user = userEvent.setup();
      render(<AgentPage />);
      await screen.findByText('1 free of 2');

      await submitStore(user);

      expect(await screen.findByText(copy)).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(RAW_CODE);
    });
  });

  describe.each([
    ['INVALID_PICKUP_CODE', 404, /that code doesn’t match this locker\./i],
    ['LOCKER_NOT_FOUND', 404, /no locker with that id at this station\./i],
    ['LOCKER_EMPTY', 409, /this locker is already empty — the package may have been picked up\./i],
    ['INTERNAL_ERROR', 500, /something went wrong on our side\./i],
  ])('retrieve surface — %s', (code, status, copy) => {
    it(`shows the calm copy and leaks no raw code`, async () => {
      retrievePackage.mockRejectedValue(apiError(code, status));
      const user = userEvent.setup();
      render(<RetrievePage />);

      await submitRetrieve(user);

      expect(await screen.findByText(copy)).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(RAW_CODE);
    });
  });

  it('the retrieval field errors are announced politely and linked', async () => {
    retrievePackage.mockRejectedValue(apiError('INVALID_PICKUP_CODE', 404));
    const user = userEvent.setup();
    render(<RetrievePage />);
    await submitRetrieve(user);

    const error = await screen.findByText(/that code doesn’t match this locker\./i);
    expect(error).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByLabelText('code character 1')).toHaveAttribute(
      'aria-describedby',
      'retrieve-code-error',
    );
  });
});
