import type { Locker, LockerRepository } from '../ports/locker-repository.js';

/**
 * `GET /lockers` — the station's live availability (FR2, AD-1).
 *
 * The response is the frozen contract `{"lockers":[{"id","size","occupied"}]}`
 * ordered by `id`; `occupied` is the only availability field and the list
 * carries no per-locker package detail. An empty station is an empty list,
 * never a 404.
 *
 * Ordering is owned here, not in the adapter: whatever order the repository
 * returns, the use case hands the HTTP layer the contract's id order.
 */
export class ListLockers {
  constructor(private readonly lockers: LockerRepository) {}

  async execute(): Promise<readonly Locker[]> {
    const lockers = await this.lockers.list();

    return [...lockers].sort((a, b) =>
      a.lockerId < b.lockerId ? -1 : a.lockerId > b.lockerId ? 1 : 0,
    );
  }
}
