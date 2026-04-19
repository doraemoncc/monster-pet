/**
 * AI API 解析器
 * T6: 大模型解析复杂任务描述
 */

async function parseTaskWithAI(text) {
  const apiKey = window.store.get('settings.aiApiKey');
  if (!apiKey) {
    return null; // 未配置 API Key，回退到本地解析
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `你是一个任务解析助手。用户会输入一个任务描述，你需要将其解析为结构化JSON。
返回格式：
{
  "title": "任务标题",
  "subtasks": ["子任务1", "子任务2"],
  "category": "school|tutoring|hobby|reading|other",
  "repeat": "daily|weekly|once",
  "suggestedCoins": 1-20的数字,
  "confidence": 0-1
}

分类规则：
- school: 校内学科（语文、数学、英语等）
- tutoring: 校外辅导班
- hobby: 兴趣爱好（钢琴、画画、运动等）
- reading: 阅读相关
- other: 其他

子任务最多3个，不要过度拆分。星币根据难度给3-15。`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    // 解析 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      title: parsed.title || text,
      subtasks: (parsed.subtasks || []).slice(0, 3).map((text, i) => ({
        id: `st_ai_${i}`,
        text,
        done: false
      })),
      category: parsed.category || 'other',
      repeat: parsed.repeat || 'once',
      suggestedCoins: Math.max(1, Math.min(20, parseInt(parsed.suggestedCoins) || 5)),
      confidence: Math.min(1, parseFloat(parsed.confidence) || 0.8)
    };
  } catch (e) {
    console.error('AI 解析失败:', e);
    return null;
  }
}
