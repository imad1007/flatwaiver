# Group participants in operational listings

Front Desk (`/checkin`) and Signatures (`/signatures`) display every group member inside the original waiver row/card. Each name opens that same signed waiver; mobile signature cards link as a whole. The first participant is labelled Primary signer. The shared waiver information and status apply to the entire group. No DOB, guardian details, or signature paths are rendered in the participant list.

There is still one signed record, PDF, export entry, and check-in control per waiver. Check-in is group-level, not individual attendance. No changes to signing, evidence generation, billing, check-in actions, or authorization policies.

## Database and performance

No new migration. Both pages use the existing `participant_search` generated column and GIN trigram index from migration 0026. Search runs in Postgres before pagination under the authenticated SSR client's RLS. Participant rendering adds no queries. Signatures retains its filters, 50-record pages, exports, and descending date order (with an ID tie-breaker). Front Desk now paginates its existing 25 search / 200 today record windows so matches beyond those windows are reachable. Groups are never split across pages.

Migration 0027 remains the separate prerequisite for the earlier DOB feature; this change does not apply migrations. Historical groups without DOB work unchanged. The renderer has no participant cap; the existing public signing limit of 10 is unchanged.

## Changed files

- `src/components/waiver-participant-list.tsx`: shared names-only group display.
- `src/app/(app)/checkin/page.tsx`: participant projection, server search, grouping, pagination and group check-in label.
- `src/app/(app)/signatures/page.tsx`: group display in desktop rows/mobile cards and stable ordering.
- `scripts/verify-participant-listings.mjs`: actual page rendering with query/permission/check-in assertions.
- This documentation.

## Manual verification

1. Open `/checkin` as staff. Compare a single waiver and groups with 2 and 10 participants. Every name should be visible; one group check-in control should remain. Check in and undo, and verify the group retains one shared status.
2. Search for an additional participant on an older waiver. Open their name and confirm it opens the original record. Follow Next/Previous on searches with more than 25 matching waivers.
3. Repeat in `/signatures`, including name/email/date/template/flag filters and pagination. CSV/PDF exports should contain one record/PDF per waiver, with existing participant data intact.
4. Repeat on a narrow mobile screen. Names wrap; Signatures uses cards; Front Desk retains its horizontally scrollable table.
5. Check a historical group without DOB. No DOB should appear in listings for any record.
6. As viewer, confirm check-in controls are read-only. Switch organizations and verify other organizations' records cannot be searched or opened.

Automated coverage renders 12-participant fixtures as a forward-compatibility check; it does not increase the signing limit. A real browser/mobile smoke test and production-scale query timing remain manual checks.

## Regression review

Fixed Front Desk silently losing check-in status and undercounting the total after the default 1,000-row API cap. Today's check-ins are now fetched in ordered batches; a 1,001-record regression verifies the last group's status and the distinct-waiver total. This preserves the existing count semantics and adds no participant-level queries. The search field now fits narrow containers and has an accessible label.

Added `scripts/verify-checkin-actions.mjs` to exercise the actual check-in/undo actions with organization filters, staff/viewer permissions and sequential duplicate prevention. Listing coverage checks single/2/10/12-person groups, historical DOB omissions, navigation, search/filter/range queries and absence of sensitive data in markup.

The broader responsive contract suite currently fails on an unchanged waiver-editor assertion (`overflow-x-hidden overflow-y-auto`); its Front Desk assertions pass. No unrelated editor changes were made. Browser surfaces are unavailable, so physical/mobile browser rendering is unverified. Production query latency and simultaneous check-in requests remain untested. Existing check-in creation uses a read-before-insert operation without a database uniqueness constraint, so simultaneous requests are not guaranteed to deduplicate; this predates the listing changes. Batch retrieval assumes the default API row cap of at least 1,000 and is not a transaction snapshot while staff make concurrent changes.
