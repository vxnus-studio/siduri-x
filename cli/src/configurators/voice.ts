import inquirer from 'inquirer';
import { OrganConfiguratorContext, OrganConfigurationResult } from './types';

export async function configureVoice(
  _context: OrganConfiguratorContext
): Promise<OrganConfigurationResult> {
  const companionSlug = _context.companionName.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'default';

  const { provider } = await inquirer.prompt<{ provider: string }>({
    type: 'list',
    name: 'provider',
    message: 'Voice provider?',
    choices: [
      {
        name: 'RVC (Custom user-owned voice model via .pth / .index weights)',
        value: 'rvc',
      },
      {
        name: 'VOICEVOX (Standard VOICEVOX stock character voice banks)',
        value: 'voicevox',
      },
      {
        name: 'None (Disable voice synthesis)',
        value: 'none',
      },
    ],
  });

  if (provider === 'none') {
    return {
      config: { provider: 'none' },
      summary: { Provider: 'None (Voice disabled)' },
    };
  }

  if (provider === 'rvc') {
    const rvcAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'modelPath',
        message: 'RVC Model Path (.pth weights):',
        default: `./assets/voice/${companionSlug}/${companionSlug}.pth`,
      },
      {
        type: 'input',
        name: 'indexPath',
        message: 'RVC Feature Index Path (.index, optional):',
        default: `./assets/voice/${companionSlug}/${companionSlug}.index`,
      },
      {
        type: 'input',
        name: 'pitchShift',
        message: 'Pitch Shift (semitones, e.g. 0 for neutral, 12 for male-to-female, -12 for female-to-male):',
        default: '0',
        validate: (v: string) => !isNaN(parseInt(v, 10)) || 'Pitch shift must be an integer.',
      },
      {
        type: 'list',
        name: 'f0Method',
        message: 'Pitch Extraction Algorithm (F0 Method):',
        choices: ['rmvpe', 'pm', 'harvest', 'crepe'],
        default: 'rmvpe',
      },
      {
        type: 'list',
        name: 'baseTts',
        message: 'Base TTS Engine for RVC (Generates initial audio):',
        choices: [
          { name: 'Edge-TTS (Cloud API, 0MB)', value: 'edge-tts' },
          { name: 'Kokoro TTS (Local, ~80MB)', value: 'kokoro' },
          { name: 'Piper TTS (Local, ~20MB)', value: 'piper' },
        ],
        default: 'edge-tts',
      },
      {
        type: 'input',
        name: 'serviceUrl',
        message: 'RVC Headless Service URL:',
        default: 'http://localhost:50055',
      },
    ]);

    const pitchShift = parseInt(rvcAnswers.pitchShift, 10) || 0;

    const config: Record<string, any> = {
      provider: rvcAnswers.baseTts,
      maxQueueDepth: 50,
      rvc: {
        enabled: true,
        serviceUrl: rvcAnswers.serviceUrl.trim(),
        modelName: companionSlug,
        modelPath: rvcAnswers.modelPath.trim(),
        indexPath: rvcAnswers.indexPath.trim() || undefined,
        pitchShift,
        f0Method: rvcAnswers.f0Method,
        indexRate: 0.75,
      },
    };

    const summary: Record<string, string | number> = {
      Provider: 'RVC (Custom Voice Model)',
      'Base TTS': rvcAnswers.baseTts,
      'Model Path': rvcAnswers.modelPath.trim(),
      'Pitch Shift': pitchShift,
      'F0 Method': rvcAnswers.f0Method,
      'RVC Service': rvcAnswers.serviceUrl.trim(),
    };

    return {
      config,
      summary,
    };
  }

interface VoicevoxStyle {
  id: number;
  name: string;
}

interface VoicevoxSpeaker {
  name: string;
  speaker_uuid: string;
  styles: VoicevoxStyle[];
}

const DEFAULT_VOICEVOX_SPEAKERS: VoicevoxSpeaker[] = [
  {
    name: '四国めたん (Shikoku Metan)',
    speaker_uuid: '7ffcb7ce-00ec-4bdc-82cd-45a8889e43ff',
    styles: [
      { id: 2, name: 'ノーマル (Normal)' },
      { id: 0, name: 'あまあま (Sweet)' },
      { id: 4, name: 'ツンツン (Tsundere)' },
      { id: 6, name: 'セクシー (Sexy)' },
      { id: 36, name: 'ささやき (Whisper)' },
      { id: 37, name: 'ヒソヒソ (Hisoniso)' },
    ],
  },
  {
    name: 'ずんだもん (Zundamon)',
    speaker_uuid: '388f24ea-105d-4354-b46e-22d7d7ff4479',
    styles: [
      { id: 3, name: 'ノーマル (Normal)' },
      { id: 1, name: 'あまあま (Sweet)' },
      { id: 5, name: 'ツンツン (Tsundere)' },
      { id: 7, name: 'セクシー (Sexy)' },
      { id: 22, name: 'ささやき (Whisper)' },
      { id: 38, name: 'ヒソヒソ (Hisoniso)' },
      { id: 75, name: 'ヘロヘロ (Herohero)' },
      { id: 76, name: 'なみだめ (Namidame)' },
    ],
  },
  {
    name: '春日部つむぎ (Kasukabe Tsumugi)',
    speaker_uuid: '35b2c544-660e-401e-b033-0ab4756917cd',
    styles: [{ id: 8, name: 'ノーマル (Normal)' }],
  },
  {
    name: '雨晴はう (Rainy Hau)',
    speaker_uuid: '3474ee95-c274-47f9-aa1a-8322163d77f1',
    styles: [{ id: 10, name: 'ノーマル (Normal)' }],
  },
  {
    name: '波音リツ (Namine Ritsu)',
    speaker_uuid: 'b1a81618-b27b-40d2-b0ea-27a9ad408c4b',
    styles: [{ id: 9, name: 'ノーマル (Normal)' }],
  },
  {
    name: '玄野武宏 (Kurono Takehiro)',
    speaker_uuid: 'c30dc15a-0992-4f8d-8bb8-ad3b76579016',
    styles: [
      { id: 11, name: 'ノーマル (Normal)' },
      { id: 39, name: '喜び (Joy)' },
      { id: 40, name: 'ツンツン (Tsundere)' },
      { id: 41, name: '悲しみ (Sadness)' },
    ],
  },
  {
    name: '白上虎太郎 (Shirakami Kotaro)',
    speaker_uuid: 'e50289b4-43ff-49e6-9b58-d894c23fb4ac',
    styles: [
      { id: 12, name: 'ふつう (Normal)' },
      { id: 32, name: 'わーい (Yay)' },
      { id: 33, name: 'びくびく (Timid)' },
      { id: 34, name: 'おこ (Angry)' },
      { id: 35, name: 'びえーん (Crying)' },
    ],
  },
  {
    name: '青山龍星 (Aoyama Ryusei)',
    speaker_uuid: '4f51116a-d9ee-4516-925d-02f183e2af8d',
    styles: [
      { id: 13, name: 'ノーマル (Normal)' },
      { id: 81, name: '熱血 (Passionate)' },
      { id: 82, name: '不気味 (Eerie)' },
      { id: 83, name: '囁き (Whisper)' },
    ],
  },
  {
    name: '冥鳴ひまり (Meimei Himari)',
    speaker_uuid: '8ea4fcd4-a013-4095-abb3-11b5bf837d37',
    styles: [{ id: 14, name: 'ノーマル (Normal)' }],
  },
  {
    name: '九州そら (Kyushu Sora)',
    speaker_uuid: '481fb609-6446-4870-9f46-90c4dd623403',
    styles: [
      { id: 16, name: 'ノーマル (Normal)' },
      { id: 15, name: 'あまあま (Sweet)' },
      { id: 17, name: 'ツンツン (Tsundere)' },
      { id: 18, name: 'セクシー (Sexy)' },
      { id: 19, name: 'ささやき (Whisper)' },
    ],
  },
  {
    name: 'モチノ・キョウコ (Mochino Kyoko)',
    speaker_uuid: 'a402a5d2-085e-4b44-a034-7164ff24a3cf',
    styles: [
      { id: 20, name: 'ノーマル (Normal)' },
      { id: 60, name: 'セクシー／タレント (Sexy)' },
      { id: 61, name: '泣き (Crying)' },
    ],
  },
  {
    name: '剣崎雌雄 (Kenzaki Mesuo)',
    speaker_uuid: '1a1756a4-263d-42ea-86a2-96f107f474e9',
    styles: [{ id: 21, name: 'ノーマル (Normal)' }],
  },
  {
    name: '後鬼 (Goki)',
    speaker_uuid: '80991a54-61c4-4b5f-8700-11234c062085',
    styles: [
      { id: 27, name: '人間ver. (Human)' },
      { id: 28, name: '鬼ver. (Oni)' },
    ],
  },
  {
    name: 'No.7 (Seven)',
    speaker_uuid: 'c86c757c-cb24-4ea0-b6f7-33c872ff72e2',
    styles: [
      { id: 29, name: 'ノーマル (Normal)' },
      { id: 30, name: 'アナウンス (Announce)' },
      { id: 31, name: '読み聞かせ (Storytelling)' },
    ],
  },
  {
    name: 'ちび式じい (Chibishiki Jii)',
    speaker_uuid: '1e19d52b-426b-4e12-b250-bfbe55c0c9cb',
    styles: [{ id: 42, name: 'ノーマル (Normal)' }],
  },
  {
    name: '櫻歌ミコ (Ouka Miko)',
    speaker_uuid: '06155980-bfab-443b-a9b8-3e4b786c7ccb',
    styles: [
      { id: 43, name: 'ノーマル (Normal)' },
      { id: 44, name: '第二形態 (2nd Form)' },
      { id: 45, name: 'ロリ (Loli)' },
    ],
  },
  {
    name: '小夜/SAYO',
    speaker_uuid: 'a8fb71e1-8738-4e16-b541-002f23ea3e45',
    styles: [{ id: 46, name: 'ノーマル (Normal)' }],
  },
  {
    name: 'ナースロボ＿タイプＴ (Nurse Robot Type T)',
    speaker_uuid: '882a636f-3bac-431a-966d-c5e6bba9f949',
    styles: [
      { id: 47, name: 'ノーマル (Normal)' },
      { id: 48, name: '楽々 (Relaxed)' },
      { id: 49, name: '恐怖 (Fear)' },
      { id: 50, name: '内緒話 (Secret Talk)' },
    ],
  },
  {
    name: '猫使アル (Nekotsuka Aru)',
    speaker_uuid: '7253579b-240e-4328-b0a6-574ab57597ea',
    styles: [
      { id: 55, name: 'ノーマル (Normal)' },
      { id: 56, name: 'おちつき (Calm)' },
      { id: 57, name: 'うきうき (Excited)' },
    ],
  },
  {
    name: '猫使ビィ (Nekotsuka Bi)',
    speaker_uuid: 'cf6204c3-6316-43b9-a095-2eb49e29a914',
    styles: [
      { id: 58, name: 'ノーマル (Normal)' },
      { id: 59, name: 'おちつき (Calm)' },
      { id: 62, name: '人見知り (Shy)' },
    ],
  },
];

async function getVoicevoxSpeakers(baseUrl: string): Promise<VoicevoxSpeaker[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(new URL('/speakers', baseUrl).toString(), {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = (await res.json()) as VoicevoxSpeaker[];
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (_e) {
    // If local instance is unreachable, fallback to the pre-populated list
  }
  return DEFAULT_VOICEVOX_SPEAKERS;
}

function buildSpeakerChoices(speakers: VoicevoxSpeaker[]): { name: string; value: { id: number; label: string } }[] {
  const choices: { name: string; value: { id: number; label: string } }[] = [];
  for (const speaker of speakers) {
    for (const style of speaker.styles) {
      const label = `${speaker.name} - ${style.name} (ID: ${style.id})`;
      choices.push({
        name: label,
        value: { id: style.id, label },
      });
    }
  }
  return choices;
}

// provider === 'voicevox'
  const urlAnswer = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseUrl',
      message: 'VOICEVOX Engine Base URL:',
      default: 'http://localhost:50021',
    },
  ]);

  const baseUrl = urlAnswer.baseUrl.trim() || 'http://localhost:50021';
  const speakers = await getVoicevoxSpeakers(baseUrl);
  const speakerChoices = buildSpeakerChoices(speakers);

  const speakerAnswer = await inquirer.prompt<{ speaker: { id: number; label: string } }>([
    {
      type: 'list',
      name: 'speaker',
      message: 'Select VOICEVOX Character Voice Bank & Style:',
      choices: speakerChoices,
      pageSize: 15,
    },
  ]);

  let speakerId = 1;
  let speakerLabel = '四国めたん (Shikoku Metan) - ノーマル (Normal) (ID: 2)';

  if (speakerAnswer && speakerAnswer.speaker) {
    if (typeof speakerAnswer.speaker === 'object' && 'id' in speakerAnswer.speaker) {
      speakerId = speakerAnswer.speaker.id;
      speakerLabel = speakerAnswer.speaker.label;
    } else if (typeof speakerAnswer.speaker === 'number') {
      speakerId = speakerAnswer.speaker;
      speakerLabel = `Speaker ID: ${speakerId}`;
    } else if (typeof speakerAnswer.speaker === 'string') {
      speakerId = parseInt(speakerAnswer.speaker, 10) || 1;
      speakerLabel = `Speaker ID: ${speakerId}`;
    }
  }

  const config: Record<string, any> = {
    provider: 'voicevox',
    baseUrl,
    speakerId,
    maxQueueDepth: 50,
  };

  const summary: Record<string, string | number> = {
    Provider: 'VOICEVOX (Stock Voice Bank)',
    'Voice Bank': speakerLabel,
    'Speaker ID': speakerId,
    'Base URL': baseUrl,
  };

  return {
    config,
    summary,
  };
}
