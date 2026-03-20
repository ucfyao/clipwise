import { aiChat, extractJSON } from "@/lib/ai";

export interface PlatformCopy {
  platform: string;
  title: string;
  description: string;
  hashtags: string[];
}

export interface ClipCopy {
  clip_title: string;
  platforms: PlatformCopy[];
}

export async function generateCopy(
  clips: Array<{ title: string; start: number; end: number; reason: string }>,
  videoContext: string
): Promise<ClipCopy[]> {
  const prompt = `你是一个短视频运营专家。为以下教学视频片段生成多平台发布文案。

视频主题: ${videoContext}

片段列表:
${clips.map((c, i) => `${i + 1}. "${c.title}" (${Math.round(c.end - c.start)}秒) - ${c.reason}`).join("\n")}

为每个片段生成 3 个平台的文案：抖音、小红书、YouTube Shorts

要求：
- 抖音：标题简短有力，描述口语化，hashtag 用 # 号
- 小红书：标题带 emoji，描述种草风，hashtag 用 # 号
- YouTube Shorts：英文标题和描述，hashtag 用 # 号

返回 JSON：
{
  "clips": [
    {
      "clip_title": "原始片段标题",
      "platforms": [
        {
          "platform": "douyin",
          "title": "...",
          "description": "...",
          "hashtags": ["tag1", "tag2", "tag3"]
        },
        {
          "platform": "xiaohongshu",
          "title": "...",
          "description": "...",
          "hashtags": ["tag1", "tag2"]
        },
        {
          "platform": "youtube_shorts",
          "title": "...",
          "description": "...",
          "hashtags": ["tag1", "tag2"]
        }
      ]
    }
  ]
}

只返回 JSON，不要其他文字。`;

  try {
    const response = await aiChat(prompt, 4096);
    const result = extractJSON<{ clips: ClipCopy[] }>(response.text);
    return result.clips || [];
  } catch {
    return [];
  }
}
