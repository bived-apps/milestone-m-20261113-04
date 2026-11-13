# Roadmap

Resolve the milestone assigned by the owner. Issues define the done-when criteria; pull-request reports and green checks do not substitute for completion evidence.

- Gate 1: the supervisor agrees the split; every issue has a done-when and checks, with shared files arbitrated.
- Gate 2: a delegate that failed twice is split again or raised to the supervisor; a coordinator does not take over implementation.
- Gate 3: review the milestone's completion, outstanding issues, and required checks before merging to main.

## Milestone m — recovery

- [x] Audit ten scoped issues, merged branches and PRs #15/#17/#19/#21/#22/#23; bounded targeted evidence distinguishes literal delivery from readiness.
- [x] Supervisor gate 1: runner-only recovery #24, limited to `scripts/run-tests.mjs` and `tests/run-tests.test.mjs`; no workflow changes.
- [ ] Deliver and review #24: discover both test suffixes, execute beyond twelve, fail nonzero for failures/timeouts/omissions/discovery errors, and prevent recursive fixture execution. Unmerged work is not delivered.
- [ ] Obtain complete genuine reports for #15/#19 and arrange eligible independent review; preserve #15-before-#19 ordering when otherwise independent.
- [ ] Hold Garnet corrections pending whitespace contract and original session provenance; retain all forty tests.
- [ ] Defer Acorn, Cobalt and optional Amber implementation until separately approved. Missing Cobalt CI is blocking, not waived.
- [ ] Resolve supervisor qualification, review-account limitation and owner authorization before any merge. Gate 3 remains unapproved; #22/#23 remain open pending disposition.
- [ ] Run core checks once after an eventual approved batch of merges; no fresh-clone release/full certification is claimed.
