/**
 * 任务模板数据
 * T6: 默认模板库
 */

const DEFAULT_TEMPLATES = [
  // 校内
  {
    id: 'default_school_chinese',
    title: '语文作业',
    category: 'school',
    subtasks: [],
    coins: 5,
    repeat: 'daily',
    isDefault: true
  },
  {
    id: 'default_school_math',
    title: '数学作业',
    category: 'school',
    subtasks: [],
    coins: 5,
    repeat: 'daily',
    isDefault: true
  },
  {
    id: 'default_school_english',
    title: '英语作业',
    category: 'school',
    subtasks: [],
    coins: 5,
    repeat: 'daily',
    isDefault: true
  },
  // 校外
  {
    id: 'default_tutoring_yuanyuan',
    title: '圆圆老师（数学）',
    category: 'tutoring',
    subtasks: [
      { text: '课后巩固', done: false },
      { text: '专属探索', done: false }
    ],
    coins: 8,
    repeat: 'weekly',
    isDefault: true
  },
  {
    id: 'default_tutoring_daniel',
    title: 'Daniel 作业（英语）',
    category: 'tutoring',
    subtasks: [
      { text: 'Workbook', done: false }
    ],
    coins: 5,
    repeat: 'daily',
    isDefault: true
  },
  // 兴趣
  {
    id: 'default_hobby_piano',
    title: '钢琴练习',
    category: 'hobby',
    subtasks: [],
    coins: 5,
    repeat: 'daily',
    isDefault: true
  },
  // 阅读
  {
    id: 'default_reading_daily',
    title: '每日阅读',
    category: 'reading',
    subtasks: [],
    coins: 4,
    repeat: 'daily',
    isDefault: true
  },
  {
    id: 'default_reading_chinese',
    title: '中文书阅读',
    category: 'reading',
    subtasks: [],
    coins: 4,
    repeat: 'daily',
    isDefault: true
  }
];

// 获取分类对应的默认模板
function getTemplatesForCategory(category) {
  return DEFAULT_TEMPLATES.filter(t => t.category === category);
}

// 获取用户自定义模板
function getMyTemplates(category) {
  const all = window.store.get('myTemplates') || [];
  return all.filter(t => !category || t.category === category);
}

// 保存用户模板
function saveMyTemplate(template) {
  const myTemplates = window.store.get('myTemplates') || [];
  if (myTemplates.length >= 20) {
    showToast('最多保存 20 个自定义模板', 'warning');
    return false;
  }
  template.id = 'my_' + Date.now();
  template.isDefault = false;
  myTemplates.push(template);
  window.store.set('myTemplates', myTemplates);
  return true;
}
