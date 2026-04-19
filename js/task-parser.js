/**
 * 本地规则解析器
 * T6: 从自然语言中提取任务信息
 */

function parseTaskInput(text) {
  if (!text || !text.trim()) return null;

  const input = text.trim();
  let title = input;
  let subtasks = [];
  let category = 'other';
  let repeat = 'once';
  let deadline = null;
  let suggestedCoins = 5;
  let confidence = 0.5; // 置信度

  // === 1. 识别分类 ===
  const categoryKeywords = {
    school: ['语文', '数学', '英语', '校内', '作业', '考试', '默写', '听写', '作文'],
    tutoring: ['圆圆老师', 'Daniel', '校外', '辅导', '补习', '家教'],
    hobby: ['钢琴', '画画', '舞蹈', '游泳', '跳绳', '篮球', '足球', '音乐', '练琴', '练习'],
    reading: ['阅读', '读书', '看书', '绘本', '故事']
  };

  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => input.includes(kw))) {
      category = cat;
      confidence += 0.2;
      break;
    }
  }

  // === 2. 识别重复规则 ===
  if (/每天|每日|日常|daily/i.test(input)) {
    repeat = 'daily';
    confidence += 0.1;
    title = title.replace(/每天|每日|日常/gi, '').trim();
  } else if (/每周|周\d|星期|week/i.test(input)) {
    repeat = 'weekly';
    confidence += 0.1;
    title = title.replace(/每周|星期/gi, '').trim();
  }

  // === 3. 识别时间/截止时间 ===
  const timeMatch = input.match(/(\d+)\s*(分钟|小时|个小时)/);
  if (timeMatch) {
    const num = parseInt(timeMatch[1]);
    const unit = timeMatch[2];
    if (unit.includes('小时')) {
      deadline = new Date(Date.now() + num * 3600000).toISOString();
      suggestedCoins = Math.max(5, Math.min(20, num * 3));
    } else {
      deadline = new Date(Date.now() + num * 60000).toISOString();
      suggestedCoins = Math.max(3, Math.min(15, Math.ceil(num / 10) * 2));
    }
    title = title.replace(/\d+\s*(分钟|小时|个小时)/, '').trim();
    confidence += 0.15;
  }

  // === 4. 拆分子任务（连接词） ===
  const separators = /[，,；;、]+|然后|接着|之后|还有|以及|和(?![带])/g;
  const parts = input.split(separators).map(s => s.trim()).filter(s => s.length > 0);

  // 移除包含时间/重复规则的部分
  const cleanParts = parts.filter(p => {
    return !/^\d+\s*(分钟|小时)/.test(p) && !/^(每天|每日|每周)/.test(p);
  });

  if (cleanParts.length >= 2 && cleanParts.length <= 4) {
    // 有多个部分，拆为子任务
    subtasks = cleanParts.slice(0, 3).map((p, i) => ({
      id: `st_new_${i}`,
      text: p.replace(/^(完成|做|写|读|练|复习|预习)\s*/g, '').trim() || p,
      done: false
    }));
    title = parts[0]; // 第一个作为标题
    confidence += 0.1;
  }

  // 清理标题
  title = title.replace(/^(完成|做|写|读|练|复习|预习)\s*/g, '').trim();
  if (!title) title = input;

  // === 5. 根据分类推断星币 ===
  if (suggestedCoins === 5) {
    const coinMap = {
      school: 5,
      tutoring: 8,
      hobby: 5,
      reading: 4,
      other: 3
    };
    suggestedCoins = coinMap[category] || 5;
  }

  return {
    title,
    subtasks,
    deadline,
    repeat,
    category,
    suggestedCoins,
    confidence: Math.min(1, confidence)
  };
}
