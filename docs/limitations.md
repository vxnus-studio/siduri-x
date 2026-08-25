# Limitations

Status: current compatibility baseline; public blank-slate parity incomplete

This register describes known gaps. It is not a list of intentionally dropped
features and must be read with the [repository health audit](./REPOSITORY_HEALTH_AUDIT.md).

- **Public chat routing**: `/chat` still forces a legacy private/owner route;
  neutral channel and audience extraction is pending.
- **Identity and subjects**: the runtime still contains `Primary User`,
  `primary_user`, creator, and `MASTER_PRIVATE` assumptions.
- **Companion selection**: web and operator clients still send a hardcoded
  `default` companion ID in several paths.
- **Memory lifecycle**: compatibility APIs exist, but complete source-event,
  approval, audience, validity, supersession, revocation, and audit parity is
  not verified at the public API boundary.
- **Behavior lifecycle**: Active Self compilation exists, but neutral audience,
  channel, session, and subject semantics are not yet extracted.
- **Blank-slate tests**: the B0–B9 baseline is specified but not yet fully
  ported through the actual API/runtime boundary.
- **Response approval**: grounded observation and response approval are not
  yet connected to public output, voice, overlay, or platform sends.
- **Knowledge trust boundary**: knowledge integration preserves citations, but
  provider/OCR/platform data still requires the full pending-candidate and
  untrusted-context regression suite.
- **Platform ingestion and outbound delivery**: production platform adapters
  and outbound approval remain incomplete.
- **Live2D / Body**: VTube Studio control currently maps expressions/actions to
  configured VTube Studio hotkeys; model-specific hotkey naming still needs to
  be configured in VTube Studio.
- **Observation / Screen Capture**: the fixture observation organ exists with
  bounded evidence, but continuous redacted capture and grounded response
  assembly are not migrated.

The following are not acceptable reasons to close a limitation: a successful
TypeScript build, a green isolated unit test, or a compatibility API with a
different name.

- **Live2D / Body**: VTube Studio control currently maps expressions/actions to
  configured VTube Studio hotkeys; model-specific hotkey naming still needs to
  be configured in VTube Studio.
- **Observation / Screen Capture**: Not Migrated. The continuous OBS screen capture was removed in favor of a standard Vision interface.
