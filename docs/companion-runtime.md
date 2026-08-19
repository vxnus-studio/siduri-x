# Companion Runtime

Status: Implemented

Located in `apps/api/src/runtime.ts`. It acts as the central hub, receiving user messages and querying organs:

1. Retrieves `Memory` and `Knowledge` context.
2. Resolves `Behavior` injections.
3. Requests `ResponsePlan` from `Brain`.
4. Executes `Voice` queueing and `Memory` insertion based on plan.
