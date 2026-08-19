import { BrainOrgan, MemoryOrgan, VoiceOrgan, KnowledgeOrgan, VisionOrgan, BehaviorOrgan, BodyOrgan, CompanionConfig, Message } from '@siduri-y/core';

export class SiduriRuntime {
  public id: string;
  public config: CompanionConfig;
  public brain: BrainOrgan;
  public memory: MemoryOrgan;
  public voice: VoiceOrgan;
  public knowledge: KnowledgeOrgan;
  public vision: VisionOrgan;
  public behavior: BehaviorOrgan;
  public body: BodyOrgan;

  private conversationHistory: Message[] = [];

  constructor(
    id: string,
    config: CompanionConfig,
    organs: {
      brain: BrainOrgan;
      memory: MemoryOrgan;
      voice: VoiceOrgan;
      knowledge: KnowledgeOrgan;
      vision: VisionOrgan;
      behavior: BehaviorOrgan;
      body: BodyOrgan;
    }
  ) {
    this.id = id;
    this.config = config;
    this.brain = organs.brain;
    this.memory = organs.memory;
    this.voice = organs.voice;
    this.knowledge = organs.knowledge;
    this.vision = organs.vision;
    this.behavior = organs.behavior;
    this.body = organs.body;
  }

  async initialize() {
    await this.memory.initialize(this.id);
  }

  async handleUserMessage(message: string, role: 'OWNER' | 'VIEWER' | 'OPERATOR'): Promise<any> {
    this.conversationHistory.push({ role: 'user', content: message });

    const knowledgeData = await this.knowledge.search(message);
    const memoryData = await this.memory.searchClaims(message, role, 5);
    const activeDirectives = await this.memory.getDirectives();
    
    let contextPrompt = "";
    if (knowledgeData.length > 0) {
      contextPrompt += "KNOWLEDGE:\n" + knowledgeData.map(k => `- ${k.content}`).join("\n") + "\n";
    }
    if (memoryData.length > 0) {
      contextPrompt += "MEMORY:\n" + memoryData.map(m => `- ${m.subject} ${m.predicate} ${m.value}`).join("\n") + "\n";
    }

    // 3. Compile Behavior
    const behaviorInjections = await this.behavior.compile({
      activeRole: role,
      directives: activeDirectives
    });

    const systemPrompt = `You are ${this.config.name}.\n${behaviorInjections}`;

    const plan = await this.brain.generatePlan({
      systemPrompt,
      contextPrompt,
      recentMessages: this.conversationHistory.slice(-10)
    });

    this.conversationHistory.push({ role: 'assistant', content: plan.speech });

    const createdMemoryProposals: any[] = [];
    if (plan.memoryProposals) {
      for (const proposal of plan.memoryProposals) {
        const claim = await this.memory.proposeClaim({
          subject: proposal.subject,
          predicate: proposal.predicate,
          value: proposal.value,
          scope: role,
          evidence: [message]
        });
        createdMemoryProposals.push({
          proposal_id: claim.id,
          content: claim.value,
          status: 'pending',
          subject: claim.subject,
          predicate: claim.predicate,
          value: claim.value
        });
      }
    }

    const createdBehavioralProposals: any[] = [];
    if (plan.behaviorProposals) {
      for (const p of plan.behaviorProposals) {
        const directive = await this.memory.proposeDirective({
          directive: p.directive,
          scopeMatcher: ['*'],
          priority: p.priority,
        });
        createdBehavioralProposals.push({
          directive_id: directive.id,
          domain: 'behavior',
          subject: 'self',
          predicate: 'directive',
          value: p.directive,
          status: 'pending',
          behavior: {
            instruction: p.directive,
            frequency: 'always',
            preferred_positions: []
          }
        });
      }
    }

    const speechId = this.voice.enqueueSpeech(plan.speech, plan.language, 0);
    this.body.speak(speechId);

    // Map to the expected UI contract format
    return {
      response: {
        spoken_ja: plan.language === 'ja' ? plan.speech : undefined,
        subtitle_en: plan.speech,
        evidence_ids: []
      },
      metadata: {
        memory_proposals: createdMemoryProposals,
        behavioral_proposals: createdBehavioralProposals
      }
    };
  }
}
