/**
 * 数据层：localStorage 持久化 + 核心业务方法
 */

// 默认数据
const DEFAULT_DATA = {
  user: {
    name: '小探险家',
    coins: 50,
    streak: 0,
    lastActiveDate: null,
  },
  pets: [
    {
      id: 'pet_1',
      name: '小团子',
      type: 'cat',
      stage: 1,
      exp: 0,
      hunger: 80,
      mood: 70,
      energy: 90,
      sick: false,
      active: true,
      accessories: [],
      masterLevel: 0,
      createdAt: new Date().toISOString()
    }
  ],
  tasks: [
    {
      id: 'task_1',
      title: '语文作业',
      category: 'school',
      subtasks: [],
      deadline: null,
      repeat: 'daily',
      coins: 5,
      status: 'pending',
      creator: 'parent',
      enabled: true,
      isTimed: false,
      startedAt: null,
      completedAt: null,
      duration: null,
      isEarlyBird: false,
      coinsEarned: null,
      createdAt: new Date().toISOString(),
      lastResetDate: null
    },
    {
      id: 'task_2',
      title: '数学作业',
      category: 'school',
      subtasks: [],
      deadline: null,
      repeat: 'daily',
      coins: 5,
      status: 'pending',
      creator: 'parent',
      enabled: true,
      isTimed: false,
      startedAt: null,
      completedAt: null,
      duration: null,
      isEarlyBird: false,
      coinsEarned: null,
      createdAt: new Date().toISOString(),
      lastResetDate: null
    },
    {
      id: 'task_3',
      title: '圆圆老师（数学）',
      category: 'tutoring',
      subtasks: [
        { id: 'st_3_1', text: '课后巩固', done: false },
        { id: 'st_3_2', text: '专属探索', done: false }
      ],
      deadline: null,
      repeat: 'weekly',
      coins: 8,
      status: 'pending',
      creator: 'parent',
      enabled: true,
      isTimed: false,
      startedAt: null,
      completedAt: null,
      duration: null,
      isEarlyBird: false,
      coinsEarned: null,
      createdAt: new Date().toISOString(),
      lastResetDate: null
    },
    {
      id: 'task_4',
      title: 'Daniel 作业（英语）',
      category: 'tutoring',
      subtasks: [{ id: 'st_4_1', text: 'Workbook', done: false }],
      deadline: null,
      repeat: 'daily',
      coins: 5,
      status: 'pending',
      creator: 'parent',
      enabled: true,
      isTimed: false,
      startedAt: null,
      completedAt: null,
      duration: null,
      isEarlyBird: false,
      coinsEarned: null,
      createdAt: new Date().toISOString(),
      lastResetDate: null
    },
    {
      id: 'task_5',
      title: '每日阅读',
      category: 'reading',
      subtasks: [],
      deadline: null,
      repeat: 'daily',
      coins: 4,
      status: 'pending',
      creator: 'parent',
      enabled: true,
      isTimed: false,
      startedAt: null,
      completedAt: null,
      duration: null,
      isEarlyBird: false,
      coinsEarned: null,
      createdAt: new Date().toISOString(),
      lastResetDate: null
    },
    {
      id: 'task_6',
      title: '钢琴练习',
      category: 'hobby',
      subtasks: [],
      deadline: null,
      repeat: 'daily',
      coins: 5,
      status: 'pending',
      creator: 'parent',
      enabled: true,
      isTimed: false,
      startedAt: null,
      completedAt: null,
      duration: null,
      isEarlyBird: false,
      coinsEarned: null,
      createdAt: new Date().toISOString(),
      lastResetDate: null
    }
  ],
  myTemplates: [],
  weeklyPlan: {
    1: [
      { templateId: 'default_school_chinese', coins: 5, isTimed: false },
      { templateId: 'default_school_math', coins: 5, isTimed: false },
      { templateId: 'default_school_english', coins: 5, isTimed: false },
      { templateId: 'default_tutoring_daniel', coins: 5, isTimed: false },
      { templateId: 'default_hobby_piano', coins: 5, isTimed: false },
      { templateId: 'default_reading_daily', coins: 4, isTimed: false }
    ],
    2: [
      { templateId: 'default_school_chinese', coins: 5, isTimed: false },
      { templateId: 'default_school_math', coins: 5, isTimed: false },
      { templateId: 'default_school_english', coins: 5, isTimed: false },
      { templateId: 'default_tutoring_daniel', coins: 5, isTimed: false },
      { templateId: 'default_hobby_piano', coins: 5, isTimed: false },
      { templateId: 'default_reading_daily', coins: 4, isTimed: false }
    ],
    3: [
      { templateId: 'default_school_chinese', coins: 5, isTimed: false },
      { templateId: 'default_school_math', coins: 5, isTimed: false },
      { templateId: 'default_hobby_piano', coins: 5, isTimed: false },
      { templateId: 'default_reading_daily', coins: 4, isTimed: false }
    ],
    4: [
      { templateId: 'default_school_chinese', coins: 5, isTimed: false },
      { templateId: 'default_school_math', coins: 5, isTimed: false },
      { templateId: 'default_reading_daily', coins: 4, isTimed: false }
    ],
    5: [
      { templateId: 'default_school_chinese', coins: 5, isTimed: false },
      { templateId: 'default_school_math', coins: 5, isTimed: false },
      { templateId: 'default_hobby_piano', coins: 5, isTimed: false },
      { templateId: 'default_reading_daily', coins: 4, isTimed: false }
    ],
    6: [
      { templateId: 'default_tutoring_yuanyuan', coins: 8, isTimed: false },
      { templateId: 'default_reading_daily', coins: 4, isTimed: false },
      { templateId: 'default_hobby_piano', coins: 5, isTimed: false }
    ],
    0: []
  },
  earlyBirdConfig: {
    0: { enabled: true, time: '08:30' },
    1: { enabled: true, time: '06:30' },
    2: { enabled: true, time: '06:30' },
    3: { enabled: true, time: '06:30' },
    4: { enabled: true, time: '06:30' },
    5: { enabled: true, time: '06:30' },
    6: { enabled: false, time: null }
  },
  challenges: [
    { id: 'ch_1', title: '连续3天打卡', description: '每天至少完成1个任务，坚持3天！', bonusCoins: 20, accepted: false, completed: false, completedAt: null, weeklyReset: null },
    { id: 'ch_2', title: '超级阅读王', description: '一周读完2本中文书，变身阅读达人！', bonusCoins: 30, accepted: false, completed: false, completedAt: null, weeklyReset: null },
    { id: 'ch_3', title: '英语小达人', description: '一周完成5次英文阅读，你好厉害！', bonusCoins: 30, accepted: false, completed: false, completedAt: null, weeklyReset: null },
    { id: 'ch_4', title: '运动小健将', description: '连续5天完成体育运动，身体棒棒！', bonusCoins: 25, accepted: false, completed: false, completedAt: null, weeklyReset: null },
    { id: 'ch_5', title: '作文小作家', description: '独立写一篇300字以上作文，真了不起！', bonusCoins: 20, accepted: false, completed: false, completedAt: null, weeklyReset: null }
  ],
  shopItems: [],
  parentPassword: '0000',
  parentUnlockedAt: null,
  onboardingDone: false,
  remindedTasks: [],
  settings: {
    decaySpeed: 'normal',
    aiApiKey: ''
  },
  completedHistory: []
};

// 进化经验阈值
const STAGE_EXP = [0, 200, 600, 1500]; // stage 0→1: 0, 1→2: 200, 2→3: 600, 3→大师: 1500

class Store {
  constructor() {
    this.STORAGE_KEY = 'monster-pet-data';
    this._data = null;
  }

  // 初始化：读取 localStorage 或写入默认值
  init() {
    // 尝试读取当前 key
    let saved = localStorage.getItem(this.STORAGE_KEY);

    // 兼容旧版本：尝试从旧 key 迁移数据
    if (!saved) {
      const OLD_KEYS = ['monsterPet', 'monster_pet', 'petGame'];
      for (const oldKey of OLD_KEYS) {
        const oldData = localStorage.getItem(oldKey);
        if (oldData) {
          console.log('[Store] 检测到旧版数据，正在迁移:', oldKey);
          saved = oldData;
          localStorage.removeItem(oldKey);
          break;
        }
      }
    }

    if (saved) {
      try {
        this._data = JSON.parse(saved);
        // 确保新增字段存在（向后兼容）
        this._migrate();
      } catch (e) {
        console.error('数据解析失败，使用默认数据', e);
        this._data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      }
    } else {
      this._data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
    this._save();
    return this;
  }

  // 数据迁移：确保新版本新增的字段存在
  _migrate() {
    if (!this._data.completedHistory) this._data.completedHistory = [];
    if (!this._data.earlyBirdConfig) this._data.earlyBirdConfig = JSON.parse(JSON.stringify(DEFAULT_DATA.earlyBirdConfig));
    if (!this._data.myTemplates) this._data.myTemplates = [];
    if (!this._data.remindedTasks) this._data.remindedTasks = [];
    if (!this._data.shopItems) this._data.shopItems = [];
    if (!this._data.settings) this._data.settings = { decaySpeed: 'normal', aiApiKey: '' };
    if (!this._data.settings.decaySpeed) this._data.settings.decaySpeed = 'normal';
  }

  // 保存到 localStorage
  _save() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._data));
  }

  // 点号路径读取：store.get('user.coins') → 50
  get(path) {
    if (!path) return this._data;
    return path.split('.').reduce((obj, key) => obj?.[key], this._data);
  }

  // 点号路径写入：store.set('user.coins', 100)
  set(path, value) {
    const keys = path.split('.');
    let obj = this._data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    this._save();
    window.bus.emit('data:changed', path);
    return this;
  }

  // 重置所有数据
  reset() {
    this._data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    this._save();
    window.bus.emit('data:changed', '*');
    return this;
  }

  // ===== 核心业务方法 =====

  // 完成任务：计算星币（基础+连击+早鸟）、经验值、打卡
  completeTask(taskId) {
    const tasks = this.get('tasks');
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === 'completed') return null;

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    if (task.startedAt) {
      task.duration = Math.round((Date.now() - new Date(task.startedAt).getTime()) / 1000);
    }

    // 基础星币
    let coinsEarned = task.coins;
    let bonusDetail = [];

    // 连击加成（中断重置，加火力模式）
    this.checkStreak();
    let streakBonus = Math.min(this.get('user.streak'), 10);
    if (streakBonus > 0) {
      coinsEarned += streakBonus;
      bonusDetail.push({ icon: '🔥', label: '连击', value: streakBonus });
    }

    // 早鸟奖励
    const todayIndex = new Date().getDay();
    const earlyBirdConfig = this.get('earlyBirdConfig');
    const todayConfig = earlyBirdConfig && earlyBirdConfig[todayIndex];
    if (todayConfig && todayConfig.enabled && task.startedAt) {
      const startTime = new Date(task.startedAt);
      const [h, m] = todayConfig.time.split(':').map(Number);
      if (startTime.getHours() < h || (startTime.getHours() === h && startTime.getMinutes() <= m)) {
        coinsEarned += 3;
        bonusDetail.push({ icon: '🌅', label: '早鸟', value: 3 });
        task.isEarlyBird = true;
      }
    }

    // 经验值 = 基础星币 × 2（加成不加经验）
    let expEarned = task.coins * 2;

    // 提前完成奖励（一次性任务且未到截止时间）
    if (task.repeat === 'once' && task.deadline && Date.now() < new Date(task.deadline)) {
      coinsEarned = Math.ceil(coinsEarned * 1.5);
      expEarned = Math.ceil(expEarned * 1.5);
    }

    // 记录实际获得
    task.coinsEarned = { total: coinsEarned, bonus: bonusDetail };

    // 更新星币和经验
    const activePet = this.getActivePet();
    if (activePet) {
      activePet.exp = (activePet.exp || 0) + expEarned;
      this.checkEvolution(activePet.id);
      this.checkSick(activePet.id);
    }

    this.set('user.coins', this.get('user.coins') + coinsEarned);

    // 写入完成记录
    const history = this.get('completedHistory') || [];
    history.unshift({
      taskId: task.id,
      title: task.title,
      coins: coinsEarned,
      duration: task.duration,
      isEarlyBird: task.isEarlyBird,
      completedAt: task.completedAt
    });
    // 只保留最近 100 条
    if (history.length > 100) history.length = 100;
    this.set('completedHistory', history);

    this.set('tasks', tasks);
    return { coinsEarned, expEarned, bonusDetail };
  }

  // 完成子任务
  completeSubtask(taskId, subtaskId) {
    const tasks = this.get('tasks');
    const task = tasks.find(t => t.id === taskId);
    if (!task) return false;

    const subtask = task.subtasks.find(s => s.id === subtaskId);
    if (!subtask || subtask.done) return false;

    subtask.done = true;

    // 给当前宠物加 3 经验
    const activePet = this.getActivePet();
    if (activePet) {
      activePet.exp = (activePet.exp || 0) + 3;
      this.checkEvolution(activePet.id);
    }

    // 检查是否全部完成
    const allDone = task.subtasks.length > 0 && task.subtasks.every(s => s.done);
    this.set('tasks', tasks);

    if (allDone) {
      // 自动完成父任务
      return this.completeTask(taskId);
    }
    return false;
  }

  // 喂食宠物
  feedPet(foodType) {
    const foodDefs = {
      food_cookie: { coins: 3, hunger: 30, mood: 5, energy: 5, exp: 2 },
      food_bone: { coins: 10, hunger: 50, mood: 10, energy: 5, exp: 3 },
      food_cake: { coins: 15, hunger: 20, mood: 30, energy: 20, exp: 4 },
      food_candy: { coins: 5, hunger: 5, mood: 15, energy: 30, exp: 2 },
      food_shrimp: { coins: 8, hunger: 40, mood: 10, energy: 10, exp: 3 },
      food_veg: { coins: 6, hunger: 35, mood: 5, energy: 15, exp: 2 }
    };

    const food = foodDefs[foodType];
    if (!food) return false;

    const userCoins = this.get('user.coins');
    if (userCoins < food.coins) {
      showToast('星币不够哦，快去完成任务吧！', 'warning');
      return false;
    }

    const activePet = this.getActivePet();
    if (!activePet) return false;

    // 检查宠物是否可吃
    const petFoodMap = {
      cat: ['food_cookie', 'food_bone', 'food_cake', 'food_candy'],
      fish: ['food_cookie', 'food_shrimp'],
      turtle: ['food_cookie', 'food_bone', 'food_veg'],
      luna: ['food_cookie', 'food_bone', 'food_cake'],
      fairy: ['food_cookie', 'food_cake', 'food_candy'],
      octopus: ['food_cookie', 'food_candy', 'food_shrimp']
    };

    const canEat = petFoodMap[activePet.type] || ['food_cookie'];
    if (!canEat.includes(foodType)) {
      showToast('这个食物不适合你的宠物哦~', 'warning');
      return false;
    }

    // 偏好食物额外经验
    const favoriteFood = {
      cat: 'food_cake', fish: 'food_shrimp', turtle: 'food_veg',
      luna: 'food_bone', fairy: 'food_candy', octopus: 'food_shrimp'
    };

    let extraExp = 0;
    if (favoriteFood[activePet.type] === foodType) {
      extraExp = 5;
    }

    // 扣星币、更新状态
    this.set('user.coins', userCoins - food.coins);
    activePet.hunger = Math.min(100, (activePet.hunger || 0) + food.hunger);
    activePet.mood = Math.min(100, (activePet.mood || 0) + food.mood);
    activePet.energy = Math.min(100, (activePet.energy || 0) + food.energy);
    activePet.exp = (activePet.exp || 0) + food.exp + extraExp;

    this.checkEvolution(activePet.id);
    this.checkSick(activePet.id);
    this.set('pets', this.get('pets'));

    return { isFavorite: extraExp > 0 };
  }

  // 玩耍
  playWithPet() {
    const activePet = this.getActivePet();
    if (!activePet) return null;

    if (activePet.sick) {
      showToast('宠物生病了，快去完成任务帮它恢复吧！', 'warning');
      return null;
    }

    if ((activePet.energy || 0) < 10) {
      showToast('太累了，先休息一下吧~', 'warning');
      return null;
    }

    const interactions = [
      { name: 'throw_ball', icon: '🎾', mood: 25, energy: -10, exp: 3 },
      { name: 'bubbles', icon: '🫧', mood: 20, energy: -5, exp: 3 },
      { name: 'music', icon: '🎵', mood: 15, energy: -15, exp: 3 }
    ];

    const choice = interactions[Math.floor(Math.random() * interactions.length)];
    activePet.mood = Math.min(100, Math.max(0, (activePet.mood || 0) + choice.mood));
    activePet.energy = Math.min(100, Math.max(0, (activePet.energy || 0) + choice.energy));
    activePet.exp = (activePet.exp || 0) + choice.exp;

    this.checkEvolution(activePet.id);
    this.checkSick(activePet.id);
    this.set('pets', this.get('pets'));

    return choice;
  }

  // 购买商品
  buyItem(itemId) {
    const shopDefs = {
      egg_mystery: { coins: 300, type: 'egg' },
      food_bone: { coins: 10, type: 'food' },
      food_cake: { coins: 15, type: 'food' },
      food_candy: { coins: 5, type: 'food' },
      food_shrimp: { coins: 8, type: 'food' },
      food_veg: { coins: 6, type: 'food' },
      deco_crown: { coins: 100, type: 'deco' },
      deco_scarf: { coins: 80, type: 'deco' },
      deco_bow: { coins: 60, type: 'deco' }
    };

    const item = shopDefs[itemId];
    if (!item) return null;

    const userCoins = this.get('user.coins');
    if (userCoins < item.coins) return { success: false, reason: 'no_coins' };

    // 装饰品检查是否已拥有
    if (item.type === 'deco') {
      const shopItems = this.get('shopItems') || [];
      if (shopItems.includes(itemId)) return { success: false, reason: 'already_owned' };
    }

    // 扣星币
    this.set('user.coins', userCoins - item.coins);

    // 处理不同类型
    if (item.type === 'egg') {
      // 随机宠物蛋
      const types = ['cat', 'fish', 'turtle', 'luna', 'fairy', 'octopus'];
      const type = types[Math.floor(Math.random() * types.length)];
      const petNames = {
        cat: '小猫咪', fish: '小孔雀鱼', turtle: '小乌龟',
        luna: '露娜', fairy: '小精灵', octopus: '小章鱼'
      };
      const pets = this.get('pets');
      const newPet = {
        id: 'pet_' + Date.now(),
        name: petNames[type],
        type: type,
        stage: 0,
        exp: 0,
        hunger: 80,
        mood: 70,
        energy: 90,
        sick: false,
        active: false,
        accessories: [],
        masterLevel: 0,
        createdAt: new Date().toISOString()
      };
      pets.push(newPet);
      this.set('pets', pets);
      return { success: true, type: 'egg', pet: newPet };
    }

    if (item.type === 'food') {
      // 食物直接生效
      const result = this.feedPet(itemId);
      return { success: true, type: 'food', fed: !!result };
    }

    if (item.type === 'deco') {
      const shopItems = this.get('shopItems') || [];
      shopItems.push(itemId);
      this.set('shopItems', shopItems);
      return { success: true, type: 'deco', itemId };
    }

    return { success: true, type: item.type };
  }

  // 连续打卡检查（中断即重置，加火力模式）
  checkStreak() {
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = this.get('user.lastActiveDate');
    if (lastDate === today) return;

    if (lastDate) {
      const last = new Date(lastDate);
      const now = new Date(today);
      const gapDays = Math.floor((now - last) / 86400000);

      if (gapDays === 1) {
        this.set('user.streak', (this.get('user.streak') || 0) + 1);
      } else if (gapDays > 1) {
        this.set('user.streak', 0);
      }
    }

    this.set('user.lastActiveDate', today);
  }

  // 检查进化
  checkEvolution(petId) {
    const pets = this.get('pets');
    const pet = pets.find(p => p.id === petId);
    if (!pet || pet.stage >= 3) return false;

    const nextStageExp = STAGE_EXP[pet.stage + 1] || Infinity;
    if (pet.exp >= nextStageExp) {
      pet.stage++;
      if (pet.stage === 3) {
        // 计算大师等级
        const baseExp = STAGE_EXP[3];
        pet.masterLevel = Math.floor((pet.exp - baseExp) / 500);
      }
      this.set('pets', pets);
      window.bus.emit('pet:evolved', pet);
      return true;
    }
    return false;
  }

  // 检查生病
  checkSick(petId) {
    const pets = this.get('pets');
    const pet = pets.find(p => p.id === petId);
    if (!pet) return;

    const wasSick = pet.sick;
    pet.sick = (pet.hunger <= 0 || pet.mood <= 0 || pet.energy <= 0);

    if (pet.sick !== wasSick) {
      this.set('pets', pets);
      if (pet.sick) {
        window.bus.emit('pet:sick', pet);
      } else {
        window.bus.emit('pet:healed', pet);
      }
    }
  }

  // 获取当前活跃宠物
  getActivePet() {
    const pets = this.get('pets');
    return pets.find(p => p.active) || pets[0] || null;
  }

  // 重复任务刷新
  resetRepeatTasks() {
    const tasks = this.get('tasks');
    const today = new Date().toISOString().slice(0, 10);
    let changed = false;

    tasks.forEach(task => {
      if (task.lastResetDate === today) return;
      if (task.status !== 'completed' && task.status !== 'expired') return;
      if (task.repeat !== 'daily' && task.repeat !== 'weekly') return;

      // 重置子任务
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(s => s.done = false);
      }

      // 重置状态
      task.status = 'pending';
      task.startedAt = null;
      task.completedAt = null;
      task.duration = null;
      task.isEarlyBird = false;
      task.coinsEarned = null;
      task.lastResetDate = today;
      changed = true;
    });

    if (changed) {
      this.set('tasks', tasks);
    }
    return changed;
  }

  // 每日清空已提醒列表
  clearRemindedTasks() {
    const today = new Date().toISOString().slice(0, 10);
    const lastClear = this.get('_lastReminderClear');
    if (lastClear === today) return;
    this.set('remindedTasks', []);
    this.set('_lastReminderClear', today);
  }
}

// 创建全局 store 实例
window.store = new Store().init();
