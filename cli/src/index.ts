#!/usr/bin/env node
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === 'create') {
    const answers = await inquirer.prompt([
      { type: 'input', name: 'name', message: 'What do you want to name your companion?', default: 'Ganyu' },
      { type: 'list', name: 'brain', message: 'Her brain?', choices: ['OpenRouter -> [model]'] },
      { type: 'list', name: 'voice', message: 'Her voice?', choices: ['VOICEVOX -> [voice/model]'] },
      { type: 'list', name: 'memory', message: 'Her memory?', choices: ['Local -> PostgreSQL'] },
      { type: 'input', name: 'knowledgePack', message: 'Path to an E knowledge pack?', default: './knowledge-pack' },
      { type: 'list', name: 'behavior', message: 'Her starter behavior?', choices: ['Calm', 'Cheerful, Encouraging'] },
      { type: 'list', name: 'body', message: 'Her body?', choices: ['Live2D Cubism'] },
      { type: 'list', name: 'vision', message: 'Her vision?', choices: ['OpenRouter -> vision model'] }
    ]);

    console.log(`Creating ${answers.name}...`);

    const config = {
      name: answers.name,
      brain: {
        provider: answers.brain.includes('OpenRouter') ? 'openrouter' : 'unknown',
        model: 'gpt-4'
      },
      voice: {
        provider: answers.voice.includes('VOICEVOX') ? 'voicevox' : 'unknown',
        speakerId: 1
      },
      memory: {
        provider: answers.memory.includes('PostgreSQL') ? 'postgres' : 'unknown'
      },
      knowledge: { provider: 'e-knowledge', packPath: path.resolve(answers.knowledgePack) },
      behavior: {
        preset: answers.behavior,
        defaultDirectives: [
          {
            id: 'preset',
            directive: `Adopt a ${answers.behavior} personality.`,
            scopeMatcher: '*',
            priority: 10,
            companionId: 'unknown'
          }
        ]
      },
      body: {
        provider: answers.body.includes('Live2D') ? 'live2d' : 'unknown'
      },
      vision: {
        provider: answers.vision.includes('OpenRouter') ? 'openrouter' : 'unknown',
        model: 'gpt-4-vision'
      }
    };

    fs.writeFileSync(path.join(process.cwd(), 'siduri.config.json'), JSON.stringify(config, null, 2));
    console.log('Done! Generated siduri.config.json');
  } else {
    console.log('Usage: npx @vxnus/siduri create');
  }
}

main().catch(console.error);
