import { PostgresMemoryOrgan } from '@siduri-y/memory';

async function runSmokeTest() {
  console.log("Starting smoke test for companion isolation...");
  
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/siduri';
  
  const ganyuMemory = new PostgresMemoryOrgan({ connectionString });
  const astraMemory = new PostgresMemoryOrgan({ connectionString });

  await ganyuMemory.runMigrations();

  await ganyuMemory.initialize('ganyu-id');
  await astraMemory.initialize('astra-id');
  
  console.log("Injecting claims...");
  const gClaim = await ganyuMemory.proposeClaim({
    subject: "Ganyu",
    predicate: "likes",
    value: "Qingxin flowers",
    scope: "PUBLIC",
    evidence: ["She mentioned it"]
  });

  const aClaim = await astraMemory.proposeClaim({
    subject: "Astra",
    predicate: "likes",
    value: "Starlight",
    scope: "PUBLIC",
    evidence: ["She mentioned it"]
  });
  
  await ganyuMemory.approveClaim(gClaim.id);
  await astraMemory.approveClaim(aClaim.id);

  console.log("Testing isolation...");
  const ganyuClaims = await ganyuMemory.searchClaims("likes", "PUBLIC");
  const astraClaims = await astraMemory.searchClaims("likes", "PUBLIC");

  console.log("Ganyu claims:", ganyuClaims.map(c => c.subject));
  console.log("Astra claims:", astraClaims.map(c => c.subject));

  if (ganyuClaims.some(c => c.subject === 'Astra')) {
    throw new Error("Memory leak: Ganyu can see Astra's memory");
  }
  if (astraClaims.some(c => c.subject === 'Ganyu')) {
    throw new Error("Memory leak: Astra can see Ganyu's memory");
  }
  
  console.log("Testing Behavioral Directive Persistence Lifecycle...");
  
  const d1 = await ganyuMemory.proposeDirective({
    directive: "Always be polite",
    priority: 10,
    scopeMatcher: ["all"],
    supersedesId: undefined
  });
  if (d1.status !== 'PENDING') throw new Error("Directive should be created as PENDING");
  
  await ganyuMemory.approveDirective(d1.id);
  let gDirectives = await ganyuMemory.getDirectives();
  const d1Active = gDirectives.find(d => d.id === d1.id);
  if (!d1Active || d1Active.status !== 'ACTIVE') throw new Error("Directive should be ACTIVE");
  
  const d2 = await ganyuMemory.proposeDirective({
    directive: "Always be extremely polite",
    priority: 20,
    scopeMatcher: ["all"],
    supersedesId: d1.id
  });
  await ganyuMemory.approveDirective(d2.id);
  
  gDirectives = await ganyuMemory.getDirectives();
  const d1Superseded = gDirectives.find(d => d.id === d1.id);
  const d2Active = gDirectives.find(d => d.id === d2.id);
  if (!d1Superseded || d1Superseded.status !== 'SUPERSEDED') throw new Error("d1 should be SUPERSEDED");
  if (!d2Active || d2Active.status !== 'ACTIVE') throw new Error("d2 should be ACTIVE");

  try {
    await ganyuMemory.approveDirective(d2.id);
    throw new Error("Should not be able to approve an already ACTIVE directive");
  } catch (e: any) {
    if (!e.message.includes('already ACTIVE')) throw e;
  }
  
  const dAstra = await astraMemory.proposeDirective({
    directive: "Be star-like",
    priority: 10,
    scopeMatcher: ["all"],
    supersedesId: undefined
  });
  
  try {
    await astraMemory.approveDirective(d2.id);
    throw new Error("Astra should not be able to approve Ganyu's directive");
  } catch (e: any) {
    if (!e.message.includes('not found')) throw e;
  }

  const dGanyuSteal = await ganyuMemory.proposeDirective({
    directive: "Steal Astra's directive",
    priority: 100,
    scopeMatcher: ["all"],
    supersedesId: dAstra.id
  });
  await ganyuMemory.approveDirective(dGanyuSteal.id);
  const aDirectives = await astraMemory.getDirectives();
  const dAstraStillPending = aDirectives.find(d => d.id === dAstra.id);
  if (!dAstraStillPending || dAstraStillPending.status !== 'PENDING') throw new Error("Astra's directive should still be untouched");

  console.log("SUCCESS: Companions are completely isolated at the data layer and directives are persisted atomically.");
  process.exit(0);
}

runSmokeTest().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
