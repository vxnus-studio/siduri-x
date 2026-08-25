# Extraction change record template

Copy this file for every behavior, memory, prompt, or disclosure change that
extracts an experience from the original Siduri repository. Keep the record
with the change until its tests and review gates are complete.

## Change identity

- Change ID:
- Date:
- Owner:
- Related phase:
- Related matrix row:
- Health finding addressed:

## Original behavior source

- Original source file(s):
- Original test(s):
- User-visible behavior being extracted:
- Safety/privacy boundary being extracted:

Do not list a personal configuration value as behavior evidence. Explain the
invariant or outcome that the value was used to exercise.

## Neutral contract mapping

- Actor context:
- Channel:
- Audience:
- Subject reference:
- Claim/directive type:
- Sensitivity:
- Authority:
- Lifecycle states:
- Provenance/source event:
- Response approval requirement:

Record any legacy mapping explicitly. Do not silently map an authentication role
to a relationship, audience, or subject.

## Blank-slate impact

- What is the fresh-companion state before this change?
- Does this change add any default identity, relationship, address, interest,
  account, or private audience?
- If yes, stop and redesign it as explicit configuration or pending teaching.
- How is public behavior kept neutral?
- How are private claims prevented from entering public context?

## Implementation boundary

- Core contract changed:
- Adapter/organ changed:
- Runtime boundary changed:
- UI/operator boundary changed:
- Compatibility behavior retained:
- Compatibility behavior deprecated:

Keep extraction logic at the contract/adapter boundary. Do not duplicate
legacy interpretation in multiple organs.

## Evidence plan

- Unit test(s):
- API/runtime test(s):
- Regression scenario(s): B__
- Manual vertical slice:
- Negative disclosure/injection test:
- Forbidden-default scan:

Required evidence must cover both the positive behavior and the blank-slate or
privacy failure mode. A typecheck alone is not sufficient.

## Status and gate movement

- Before status:
- After status:
- Health finding resolved:
- New risks:
- Remaining gaps:
- Documentation updated:

Do not mark a phase complete unless the relevant extraction matrix row,
roadmap status, tests, and health audit all agree.

## Review checklist

- [ ] Original source and test are identified.
- [ ] Personal values were separated from extracted behavior.
- [ ] Actor, channel, audience, and subject are not conflated.
- [ ] Fresh companion remains blank slate.
- [ ] Pending/approval lifecycle is preserved.
- [ ] Provenance and source event are preserved.
- [ ] Public/private disclosure is tested.
- [ ] Untrusted context cannot change policy.
- [ ] Neutral fixtures are used.
- [ ] Documentation status is truthful.
