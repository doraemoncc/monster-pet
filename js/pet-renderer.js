/**
 * 宠物乐园页面：Canvas 绘制引擎 + 页面渲染 + 状态环
 * T3a: 页面框架 + 猫咪绘制 + 状态展示
 */

// ===== 宠物类型配置 =====
const PET_TYPES = {
  cat:     { name: '小猫咪',   emoji: '🐱', color: '#FFB6C1', eggColor: '#FFE4E1' },
  fish:    { name: '小孔雀鱼', emoji: '🐟', color: '#FFB6C1', eggColor: '#FFF0F5' },
  turtle:  { name: '小乌龟',   emoji: '🐢', color: '#90EE90', eggColor: '#F0FFF0' },
  luna:    { name: '露娜',     emoji: '🐉', color: '#F8F8FF', eggColor: '#FFF5EE' },
  fairy:   { name: '小精灵',   emoji: '🧚', color: '#E6E6FA', eggColor: '#F5F5FF' },
  octopus: { name: '小章鱼',   emoji: '🐙', color: '#DDA0DD', eggColor: '#F3E5F5' }
};

// 阶段名称
const STAGE_NAMES = ['蛋', '幼崽', '少年', '成年'];

// STAGE_EXP 已在 store.js 中定义，这里不再重复声明

// ===== 页面渲染 =====
function renderPetPage() {
  const container = document.getElementById('page-pet');
  const pet = window.store.getActivePet();
  if (!pet) {
    container.innerHTML = '<p style="text-align:center;color:#8D6E63;margin-top:80px;">还没有宠物哦~去商店买一个吧！</p>';
    return;
  }

  const petType = PET_TYPES[pet.type] || PET_TYPES.cat;

  container.innerHTML = `
    <div class="pet-header">
      <div class="pet-name-row">
        <span class="pet-name">${pet.name}</span>
        <button class="pet-switch-btn" id="pet-switch-btn" title="切换宠物">🔄</button>
      </div>
      <div class="pet-exp-bar">
        <div class="pet-exp-fill" id="pet-exp-fill"></div>
        <div class="pet-exp-text" id="pet-exp-text"></div>
      </div>
    </div>

    <div class="pet-canvas-wrap">
      <div class="pet-bubble" id="pet-bubble"></div>
      <canvas id="pet-canvas" width="300" height="300"></canvas>
    </div>

    <div class="pet-stats">
      ${renderStatRing('hunger', '🍖', '饱食度', pet.hunger)}
      ${renderStatRing('mood', '💛', '心情', pet.mood)}
      ${renderStatRing('energy', '⚡', '活力', pet.energy)}
    </div>

    <div class="pet-actions" id="pet-actions">
      <!-- T4 填充互动按钮 -->
    </div>

    <!-- 宠物切换弹窗 -->
    <div class="pet-list-overlay" id="pet-list-overlay">
      <div class="pet-list-panel">
        <div class="pet-list-title">我的宠物</div>
        <div id="pet-list-items"></div>
        <button class="pet-list-close" id="pet-list-close">关闭</button>
      </div>
    </div>
  `;

  // 绑定切换按钮
  document.getElementById('pet-switch-btn').addEventListener('click', showPetList);
  document.getElementById('pet-list-close').addEventListener('click', () => {
    document.getElementById('pet-list-overlay').classList.remove('show');
  });
  document.getElementById('pet-list-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'pet-list-overlay') {
      document.getElementById('pet-list-overlay').classList.remove('show');
    }
  });

  updateExpBar(pet);
  updateStatRings(pet);
  startCanvasAnimation();
}

// 渲染单个状态环
function renderStatRing(key, icon, label, value) {
  const circumference = 2 * Math.PI * 28; // r=28
  const offset = circumference * (1 - value / 100);
  const color = value > 60 ? '#66BB6A' : value > 20 ? '#FFA726' : '#EF5350';

  return `
    <div class="stat-ring-wrap" id="stat-${key}">
      <div class="stat-ring">
        <svg viewBox="0 0 72 72">
          <circle class="stat-ring-bg" cx="36" cy="36" r="28"/>
          <circle class="stat-ring-fill" cx="36" cy="36" r="28"
            stroke="${color}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"/>
        </svg>
        <span class="stat-ring-value">${icon}${value}</span>
      </div>
      <span class="stat-ring-label">${label}</span>
    </div>
  `;
}

// 更新经验条
function updateExpBar(pet) {
  const fillEl = document.getElementById('pet-exp-fill');
  const textEl = document.getElementById('pet-exp-text');
  if (!fillEl || !textEl) return;

  if (pet.stage >= 3) {
    // 成年后显示大师等级
    const masterLevel = pet.masterLevel || 0;
    const baseExp = STAGE_EXP[3];
    const masterProgress = Math.max(0, (pet.exp - baseExp) % 500);
    const pct = Math.min(100, masterProgress / 500 * 100);
    fillEl.style.width = pct + '%';
    textEl.textContent = `大师 Lv.${masterLevel}  ${masterProgress}/${500}`;
  } else {
    const currentThreshold = STAGE_EXP[pet.stage] || 0;
    const nextThreshold = STAGE_EXP[pet.stage + 1] || 0;
    const range = nextThreshold - currentThreshold;
    const progress = Math.max(0, pet.exp - currentThreshold);
    const pct = Math.min(100, (progress / range) * 100);
    fillEl.style.width = pct + '%';
    textEl.textContent = `${STAGE_NAMES[pet.stage]} ${progress}/${range} → ${STAGE_NAMES[pet.stage + 1] || '???'}`;
  }
}

// 更新状态环
function updateStatRings(pet) {
  ['hunger', 'mood', 'energy'].forEach(key => {
    const wrap = document.getElementById(`stat-${key}`);
    if (!wrap) return;
    const value = pet[key] || 0;
    const circumference = 2 * Math.PI * 28;
    const offset = circumference * (1 - value / 100);
    const color = value > 60 ? '#66BB6A' : value > 20 ? '#FFA726' : '#EF5350';

    const fillCircle = wrap.querySelector('.stat-ring-fill');
    const valueSpan = wrap.querySelector('.stat-ring-value');
    if (fillCircle) {
      fillCircle.setAttribute('stroke', color);
      fillCircle.setAttribute('stroke-dashoffset', offset);
    }
    if (valueSpan) {
      const icons = { hunger: '🍖', mood: '💛', energy: '⚡' };
      valueSpan.textContent = `${icons[key]}${value}`;
    }
  });
}

// 显示宠物列表弹窗
function showPetList() {
  const pets = window.store.get('pets') || [];
  const itemsEl = document.getElementById('pet-list-items');
  if (!itemsEl) return;

  itemsEl.innerHTML = pets.map(pet => {
    const pt = PET_TYPES[pet.type] || PET_TYPES.cat;
    const isActive = pet.active;
    return `
      <div class="pet-list-item ${isActive ? 'active' : ''}" data-pet-id="${pet.id}">
        <span class="pet-emoji">${pet.stage === 0 ? '🥚' : pt.emoji}</span>
        <div class="pet-info">
          <div class="name">${pet.name}</div>
          <div class="type">${pt.name}</div>
        </div>
        <div class="stage">${STAGE_NAMES[pet.stage] || '蛋'}</div>
      </div>
    `;
  }).join('');

  // 绑定点击切换
  itemsEl.querySelectorAll('.pet-list-item').forEach(item => {
    item.addEventListener('click', () => {
      const petId = item.dataset.petId;
      const pets = window.store.get('pets');
      pets.forEach(p => p.active = (p.id === petId));
      window.store.set('pets', pets);
      document.getElementById('pet-list-overlay').classList.remove('show');
      stopCanvasAnimation();
      renderPetPage();
    });
  });

  document.getElementById('pet-list-overlay').classList.add('show');
}

// ===== Canvas 绘制引擎 =====
let animationFrameId = null;
let frameCount = 0;

function startCanvasAnimation() {
  const canvas = document.getElementById('pet-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function loop() {
    frameCount++;
    const pet = window.store.getActivePet();
    if (pet) {
      ctx.clearRect(0, 0, 300, 300);
      drawPet(ctx, pet, frameCount);
    }
    animationFrameId = requestAnimationFrame(loop);
  }

  loop();
}

function stopCanvasAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// ===== 宠物分发绘制 =====
function drawPet(ctx, pet, frame) {
  const mood = pet.mood || 50;
  const hunger = pet.hunger || 50;
  const sick = pet.sick || false;

  // 任一属性 < 20 → 瞌睡
  const isSleepy = hunger < 20 || (pet.energy || 50) < 20 || mood < 20;

  const drawFn = {
    cat: drawCat,
    fish: drawFish,
    turtle: drawTurtle,
    luna: drawLuna,
    fairy: drawFairy,
    octopus: drawOctopus
  }[pet.type];

  if (drawFn) {
    drawFn(ctx, pet.stage, frame, mood, sick, isSleepy, pet.accessories);
  } else {
    drawFallback(ctx, pet, frame, sick);
  }

  // 装饰品
  if (pet.accessories && pet.accessories.length > 0) {
    drawAccessories(ctx, pet.accessories, pet.stage, frame);
  }
}

// ===== 猫咪绘制（4 阶段） =====
function drawCat(ctx, stage, frame, mood, sick, isSleepy, accessories) {
  const cx = 150, cy = 160;
  const time = frame * 0.05;

  // 生病效果：灰色滤镜 + 颤抖
  if (sick) {
    ctx.save();
    ctx.translate(Math.sin(frame * 0.5) * 2, 0);
    ctx.globalAlpha = 0.7;
  }

  if (stage === 0) {
    // === 蛋 ===
    drawEgg(ctx, cx, cy + 20, time, '#FFE4E1', '#FFB6C1');
  } else {
    // 呼吸动画
    const breathe = 1 + Math.sin(time * 2) * 0.02;
    // 跳跃动画（Stage 2+ 偶尔）
    let jumpY = 0;
    if (stage >= 2 && Math.sin(time * 0.3) > 0.9) {
      jumpY = -Math.sin((time * 0.3 - Math.asin(0.9)) * 10) * 15;
    }
    // 尾巴摇摆（Stage 3）
    const tailWag = stage >= 3 ? Math.sin(time * 3) * 0.4 : 0;

    ctx.save();
    ctx.translate(cx, cy + jumpY);
    ctx.scale(breathe, breathe);

    // 身体大小根据阶段
    const bodyScale = stage === 1 ? 0.7 : stage === 2 ? 0.85 : 1.0;
    ctx.scale(bodyScale, bodyScale);

    // === 尾巴 ===
    if (stage >= 2) {
      ctx.save();
      ctx.translate(35, 20);
      ctx.rotate(tailWag + 0.3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(20, -20, 40, -30);
      ctx.quadraticCurveTo(55, -35, 50, -20);
      ctx.quadraticCurveTo(45, -10, 20, 0);
      ctx.fillStyle = '#FFB6C1';
      ctx.fill();
      ctx.strokeStyle = '#E8A0B0';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // === 身体 ===
    ctx.beginPath();
    ctx.ellipse(0, 30, 40, 35, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFB6C1';
    ctx.fill();
    ctx.strokeStyle = '#E8A0B0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // === 头 ===
    ctx.beginPath();
    ctx.arc(0, -15, 38, 0, Math.PI * 2);
    ctx.fillStyle = '#FFB6C1';
    ctx.fill();
    ctx.strokeStyle = '#E8A0B0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // === 耳朵 ===
    drawCatEars(ctx, stage);

    // === 脸部 ===
    if (isSleepy) {
      drawSleepingFace(ctx);
    } else {
      drawCatFace(ctx, mood, stage, time);
    }

    // === 胡须 ===
    if (stage >= 2) {
      drawWhiskers(ctx);
    }

    // === 前脚 ===
    ctx.beginPath();
    ctx.ellipse(-18, 58, 10, 6, -0.2, 0, Math.PI * 2);
    ctx.ellipse(18, 58, 10, 6, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFB6C1';
    ctx.fill();
    ctx.strokeStyle = '#E8A0B0';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Stage 3 光效
    if (stage === 3) {
      ctx.save();
      ctx.globalAlpha = 0.15 + Math.sin(time) * 0.1;
      ctx.beginPath();
      ctx.arc(0, 10, 60, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD54F';
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  if (sick) {
    // 生病图标
    ctx.save();
    ctx.globalAlpha = 1;
    const iconX = cx + 30, iconY = cy - 50;
    ctx.beginPath();
    ctx.arc(iconX, iconY, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#EF5350';
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.fillRect(iconX - 5, iconY - 2, 10, 4);
    ctx.fillRect(iconX - 2, iconY - 5, 4, 10);
    ctx.restore();
    ctx.restore();
  }
}

// 猫耳朵
function drawCatEars(ctx, stage) {
  const earSize = stage === 1 ? 18 : 22;
  // 左耳
  ctx.beginPath();
  ctx.moveTo(-28, -35);
  ctx.lineTo(-20, -35 - earSize);
  ctx.lineTo(-8, -35);
  ctx.fillStyle = '#FFB6C1';
  ctx.fill();
  ctx.strokeStyle = '#E8A0B0';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 左耳内
  ctx.beginPath();
  ctx.moveTo(-24, -36);
  ctx.lineTo(-20, -35 - earSize + 5);
  ctx.lineTo(-13, -36);
  ctx.fillStyle = '#FF8FAB';
  ctx.fill();

  // 右耳
  ctx.beginPath();
  ctx.moveTo(28, -35);
  ctx.lineTo(20, -35 - earSize);
  ctx.lineTo(8, -35);
  ctx.fillStyle = '#FFB6C1';
  ctx.fill();
  ctx.strokeStyle = '#E8A0B0';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 右耳内
  ctx.beginPath();
  ctx.moveTo(24, -36);
  ctx.lineTo(20, -35 - earSize + 5);
  ctx.lineTo(13, -36);
  ctx.fillStyle = '#FF8FAB';
  ctx.fill();
}

// 猫脸表情
function drawCatFace(ctx, mood, stage, time) {
  // 眼睛
  if (mood < 30) {
    // 皱眉
    // 左眼
    ctx.beginPath();
    ctx.moveTo(-22, -20);
    ctx.lineTo(-10, -16);
    ctx.moveTo(-10, -20);
    ctx.lineTo(-22, -16);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    // 右眼
    ctx.beginPath();
    ctx.moveTo(10, -20);
    ctx.lineTo(22, -16);
    ctx.moveTo(22, -20);
    ctx.lineTo(10, -16);
    ctx.stroke();
    // 眉毛（八字眉）
    ctx.beginPath();
    ctx.moveTo(-24, -28);
    ctx.lineTo(-14, -25);
    ctx.moveTo(24, -28);
    ctx.lineTo(14, -25);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // 正常大眼睛
    const blink = Math.sin(time * 0.8) > 0.95; // 偶尔眨眼

    [-16, 16].forEach(x => {
      if (blink) {
        // 闭眼
        ctx.beginPath();
        ctx.arc(x, -18, 8, 0, Math.PI);
        ctx.strokeStyle = '#5D4037';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
      } else {
        // 眼白
        ctx.beginPath();
        ctx.ellipse(x, -18, 9, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF';
        ctx.fill();
        ctx.strokeStyle = '#5D4037';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // 瞳孔
        ctx.beginPath();
        ctx.arc(x, -16, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#5D4037';
        ctx.fill();
        // 高光
        ctx.beginPath();
        ctx.arc(x + 2, -18, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF';
        ctx.fill();
      }
    });
  }

  // 鼻子
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(-4, -4);
  ctx.lineTo(4, -4);
  ctx.closePath();
  ctx.fillStyle = '#FF8FAB';
  ctx.fill();

  // 嘴巴
  if (mood >= 60) {
    // 微笑
    ctx.beginPath();
    ctx.arc(-5, -2, 5, 0, Math.PI);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5, -2, 5, 0, Math.PI);
    ctx.stroke();
  } else if (mood >= 30) {
    // 平嘴
    ctx.beginPath();
    ctx.moveTo(-6, -1);
    ctx.lineTo(6, -1);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // 腮红
  ctx.beginPath();
  ctx.ellipse(-25, -6, 8, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,143,171,0.3)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(25, -6, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

// 瞌睡脸
function drawSleepingFace(ctx) {
  // 闭眼（弧线）
  ctx.beginPath();
  ctx.arc(-16, -18, 8, 0, Math.PI);
  ctx.strokeStyle = '#5D4037';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(16, -18, 8, 0, Math.PI);
  ctx.stroke();

  // 小嘴巴（打呼）
  ctx.beginPath();
  ctx.arc(0, -2, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#5D4037';
  ctx.fill();

  // ZZZ
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#90CAF9';
  ctx.fillText('z', 30, -40);
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Z', 38, -52);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Z', 48, -66);

  // 枕头
  ctx.beginPath();
  ctx.ellipse(0, 50, 45, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#E3F2FD';
  ctx.fill();
  ctx.strokeStyle = '#90CAF9';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// 胡须
function drawWhiskers(ctx) {
  ctx.strokeStyle = '#5D4037';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';

  // 左边
  [[-15, -8, -42, -14], [-15, -4, -42, -4], [-15, 0, -40, 6]].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
  // 右边
  [[15, -8, 42, -14], [15, -4, 42, -4], [15, 0, 40, 6]].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
}

// 通用蛋形绘制
function drawEgg(ctx, cx, cy, time, eggColor, spotColor) {
  ctx.save();
  // 轻微晃动
  const wobble = Math.sin(time * 2) * 3;
  ctx.translate(cx + wobble, cy);
  ctx.rotate(wobble * 0.01);

  // 蛋身
  ctx.beginPath();
  ctx.ellipse(0, 0, 35, 45, 0, 0, Math.PI * 2);
  ctx.fillStyle = eggColor;
  ctx.fill();
  ctx.strokeStyle = spotColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 斑点
  const spots = [[-10, -15, 5], [12, -8, 4], [-5, 10, 6], [15, 15, 3], [-18, 5, 3]];
  spots.forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = spotColor;
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // 高光
  ctx.beginPath();
  ctx.ellipse(-10, -20, 8, 12, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();

  ctx.restore();
}

// Fallback：未实现的宠物用 emoji + 蛋形
function drawFallback(ctx, pet, frame, sick) {
  const cx = 150, cy = 150;
  const time = frame * 0.05;
  const pt = PET_TYPES[pet.type] || PET_TYPES.cat;

  if (pet.stage === 0) {
    // 蛋阶段用蛋形
    drawEgg(ctx, cx, cy + 10, time, pt.eggColor, pt.color);
  } else {
    // 非 0 阶段用大 emoji 占位
    if (sick) {
      ctx.save();
      ctx.translate(Math.sin(frame * 0.5) * 2, 0);
      ctx.globalAlpha = 0.6;
    }
    ctx.font = `${60 + pet.stage * 10}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pt.emoji, cx, cy);
    if (sick) {
      ctx.restore();
      // 生病图标
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx + 30, cy - 30, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#EF5350';
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.fillRect(cx + 25, cy - 32, 10, 4);
      ctx.fillRect(cx + 28, cy - 35, 4, 10);
      ctx.restore();
    }
  }
}

// 装饰品绘制
function drawAccessories(ctx, accessories, stage, frame) {
  if (stage === 0) return; // 蛋阶段不显示装饰
  const cx = 150, cy = 100;
  const time = frame * 0.05;

  accessories.forEach(accId => {
    ctx.save();
    const floatY = Math.sin(time * 2) * 3;
    switch (accId) {
      case 'deco_crown':
        // 皇冠
        ctx.translate(cx, cy - 55 + floatY);
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(-18, 5);
        ctx.lineTo(-18, -8);
        ctx.lineTo(-10, 0);
        ctx.lineTo(0, -15);
        ctx.lineTo(10, 0);
        ctx.lineTo(18, -8);
        ctx.lineTo(18, 5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFA000';
        ctx.lineWidth = 1;
        ctx.stroke();
        // 宝石
        ctx.beginPath();
        ctx.arc(0, -3, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#EF5350';
        ctx.fill();
        break;
      case 'deco_scarf':
        // 围巾
        ctx.translate(cx, cy - 25);
        ctx.fillStyle = '#EF5350';
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // 围巾尾巴
        ctx.fillRect(15, 0, 10, 20);
        ctx.fillStyle = '#C62828';
        ctx.fillRect(17, 15, 6, 5);
        break;
      case 'deco_bow':
        // 蝴蝶结
        ctx.translate(cx, cy - 50 + floatY);
        ctx.fillStyle = '#E91E63';
        // 左翼
        ctx.beginPath();
        ctx.ellipse(-8, 0, 10, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // 右翼
        ctx.beginPath();
        ctx.ellipse(8, 0, 10, 6, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // 中心
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#C2185B';
        ctx.fill();
        break;
    }
    ctx.restore();
  });
}

// ===== 孔雀鱼绘制（4 阶段） =====
function drawFish(ctx, stage, frame, mood, sick, isSleepy, accessories) {
  const cx = 150, cy = 160;
  const time = frame * 0.05;

  if (sick) {
    ctx.save();
    ctx.translate(Math.sin(frame * 0.5) * 2, 0);
    ctx.globalAlpha = 0.7;
  }

  if (stage === 0) {
    drawEgg(ctx, cx, cy + 20, time, '#FFF0F5', '#FFB6C1');
  } else {
    const breathe = 1 + Math.sin(time * 2) * 0.015;
    // 游动摆尾
    const swimY = Math.sin(time * 3) * 5;
    const bodyScale = stage === 1 ? 0.65 : stage === 2 ? 0.8 : 1.0;

    ctx.save();
    ctx.translate(cx, cy + swimY);
    ctx.scale(breathe * bodyScale, breathe * bodyScale);

    // 尾巴（Stage 1 小尾巴 → Stage 3 华丽扇尾）
    if (stage >= 1) {
      ctx.save();
      const tailWave = Math.sin(time * 4) * 0.3;
      ctx.translate(-35, 5);
      ctx.rotate(tailWave);

      if (stage === 3) {
        // 华丽大扇尾
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 50);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.5, 'rgba(255,182,193,0.7)');
        grad.addColorStop(1, 'rgba(255,105,180,0.3)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-20, -40, -10, -55);
        ctx.quadraticCurveTo(0, -45, 0, -30);
        ctx.quadraticCurveTo(0, -45, 10, -55);
        ctx.quadraticCurveTo(20, -40, 0, 0);
        ctx.fill();
        // 尾纹
        ctx.strokeStyle = 'rgba(255,105,180,0.3)';
        ctx.lineWidth = 1;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(i * 5, -30, i * 8, -45);
          ctx.stroke();
        }
      } else {
        // 普通尾巴
        const tailLen = stage === 1 ? 20 : 35;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-tailLen * 0.6, -tailLen * 0.3, -tailLen, -tailLen * 0.2);
        ctx.quadraticCurveTo(-tailLen * 0.6, tailLen * 0.3, 0, 0);
        ctx.fillStyle = 'rgba(255,182,193,0.6)';
        ctx.fill();
      }
      ctx.restore();
    }

    // 身体
    ctx.beginPath();
    ctx.ellipse(0, 0, 40, 28, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF5F5';
    ctx.fill();
    ctx.strokeStyle = '#FFB6C1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 鱼鳍
    const finSize = stage === 1 ? 8 : stage === 2 ? 14 : 18;
    // 背鳍
    ctx.beginPath();
    ctx.moveTo(-15, -26);
    ctx.quadraticCurveTo(0, -26 - finSize, 15, -26);
    ctx.fillStyle = 'rgba(255,182,193,0.5)';
    ctx.fill();
    // 腹鳍
    ctx.beginPath();
    ctx.moveTo(-5, 26);
    ctx.quadraticCurveTo(0, 26 + finSize * 0.6, 5, 26);
    ctx.fillStyle = 'rgba(255,182,193,0.4)';
    ctx.fill();

    // 眼睛
    if (isSleepy) {
      ctx.beginPath();
      ctx.arc(18, -5, 5, 0, Math.PI);
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(18, -5, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFF';
      ctx.fill();
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(19, -4, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#5D4037';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(20, -6, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFF';
      ctx.fill();
    }

    // 嘴
    ctx.beginPath();
    ctx.arc(35, 2, 3, -0.5, 0.5);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 腮红
    ctx.beginPath();
    ctx.ellipse(22, 5, 6, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,143,171,0.25)';
    ctx.fill();

    // Stage 3 光泽
    if (stage === 3) {
      ctx.save();
      ctx.globalAlpha = 0.1 + Math.sin(time) * 0.08;
      ctx.beginPath();
      ctx.ellipse(0, 0, 50, 35, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD54F';
      ctx.fill();
      ctx.restore();
    }

    // 瞌睡 ZZZ
    if (isSleepy) {
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#90CAF9';
      ctx.fillText('z', 42, -20);
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('Z', 48, -30);
    }

    ctx.restore();
  }

  if (sick) {
    ctx.save();
    ctx.globalAlpha = 1;
    const iconX = cx + 30, iconY = cy - 50;
    ctx.beginPath();
    ctx.arc(iconX, iconY, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#EF5350';
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.fillRect(iconX - 5, iconY - 2, 10, 4);
    ctx.fillRect(iconX - 2, iconY - 5, 4, 10);
    ctx.restore();
    ctx.restore();
  }
}

// ===== 乌龟绘制（4 阶段） =====
function drawTurtle(ctx, stage, frame, mood, sick, isSleepy, accessories) {
  const cx = 150, cy = 165;
  const time = frame * 0.05;

  if (sick) {
    ctx.save();
    ctx.translate(Math.sin(frame * 0.5) * 2, 0);
    ctx.globalAlpha = 0.7;
  }

  if (stage === 0) {
    drawEgg(ctx, cx, cy + 15, time, '#F0FFF0', '#90EE90');
  } else {
    const breathe = 1 + Math.sin(time * 1.5) * 0.015;
    const bodyScale = stage === 1 ? 0.65 : stage === 2 ? 0.8 : 1.0;
    // Stage 3 偶尔缩头
    const headRetracted = stage === 3 && Math.sin(time * 0.2) > 0.85;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(breathe * bodyScale, breathe * bodyScale);

    // 腿
    const legLen = stage === 1 ? 10 : 14;
    ctx.fillStyle = '#7CB342';
    [[-25, 25, -0.3], [25, 25, 0.3], [-28, -5, -0.5], [28, -5, 0.5]].forEach(([x, y, rot]) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, legLen / 2, 8, legLen / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 尾巴
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.quadraticCurveTo(-5, 40, 0, 45);
    ctx.strokeStyle = '#7CB342';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 壳
    ctx.beginPath();
    ctx.ellipse(0, 5, 38, 30, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#8BC34A';
    ctx.fill();
    ctx.strokeStyle = '#689F38';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 壳花纹（Stage 2+ 六边形）
    if (stage >= 2) {
      ctx.strokeStyle = '#689F38';
      ctx.lineWidth = 1;
      const hexR = 8;
      [[-12, -5], [12, -5], [0, 8], [-12, 15], [12, 15]].forEach(([hx, hy]) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 3 * i - Math.PI / 6;
          const px = hx + hexR * Math.cos(a);
          const py = hy + hexR * Math.sin(a);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      });
      // 壳中心圆
      ctx.beginPath();
      ctx.arc(0, 5, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#689F38';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Stage 1 简单纹理
      ctx.beginPath();
      ctx.arc(0, 5, 15, 0, Math.PI * 2);
      ctx.strokeStyle = '#689F38';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 头
    if (!headRetracted) {
      ctx.beginPath();
      ctx.arc(0, -30, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#7CB342';
      ctx.fill();
      ctx.strokeStyle = '#689F38';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 眼睛
      if (isSleepy) {
        ctx.beginPath();
        ctx.arc(-6, -32, 4, 0, Math.PI);
        ctx.moveTo(6, -32);
        ctx.arc(6, -32, 4, 0, Math.PI);
        ctx.strokeStyle = '#5D4037';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
      } else {
        [-6, 6].forEach(ex => {
          ctx.beginPath();
          ctx.arc(ex, -32, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#FFF';
          ctx.fill();
          ctx.strokeStyle = '#5D4037';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ex, -31, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#33691E';
          ctx.fill();
        });
      }

      // 嘴
      ctx.beginPath();
      ctx.arc(0, -26, 3, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 瞌睡
      if (isSleepy) {
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#90CAF9';
        ctx.fillText('z', 16, -42);
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('Z', 22, -52);
      }
    }

    // 腮红
    ctx.beginPath();
    ctx.ellipse(-14, -24, 5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(14, -24, 5, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,183,77,0.25)';
    ctx.fill();

    ctx.restore();
  }

  if (sick) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx + 35, cy - 40, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#EF5350';
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.fillRect(cx + 30, cy - 42, 10, 4);
    ctx.fillRect(cx + 33, cy - 45, 4, 10);
    ctx.restore();
    ctx.restore();
  }
}

// ===== 露娜·光煞绘制（4 阶段） =====
function drawLuna(ctx, stage, frame, mood, sick, isSleepy, accessories) {
  const cx = 150, cy = 155;
  const time = frame * 0.05;

  if (sick) {
    ctx.save();
    ctx.translate(Math.sin(frame * 0.5) * 2, 0);
    ctx.globalAlpha = 0.7;
  }

  if (stage === 0) {
    // 珍珠白蛋 + 银色光纹
    ctx.save();
    const wobble = Math.sin(time * 2) * 3;
    ctx.translate(cx + wobble, cy + 20);
    ctx.rotate(wobble * 0.01);

    ctx.beginPath();
    ctx.ellipse(0, 0, 35, 45, 0, 0, Math.PI * 2);
    const eggGrad = ctx.createRadialGradient(-5, -10, 5, 0, 0, 45);
    eggGrad.addColorStop(0, '#FFFAF0');
    eggGrad.addColorStop(1, '#F5F5F5');
    ctx.fillStyle = eggGrad;
    ctx.fill();
    ctx.strokeStyle = '#C0C0C0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 银色光纹斑点
    [[-10, -15, 4], [12, -8, 3], [-5, 10, 5], [15, 15, 3], [-18, 5, 3]].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(192,192,192,${0.3 + Math.sin(time + x) * 0.2})`;
      ctx.fill();
    });

    // 柔和发光
    ctx.save();
    ctx.globalAlpha = 0.15 + Math.sin(time * 2) * 0.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 45, 55, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#E3F2FD';
    ctx.fill();
    ctx.restore();

    ctx.restore();
  } else {
    const breathe = 1 + Math.sin(time * 1.5) * 0.015;
    const bodyScale = stage === 1 ? 0.6 : stage === 2 ? 0.8 : 1.0;
    const wingFlap = Math.sin(time * 2) * 0.15;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(breathe * bodyScale, breathe * bodyScale);

    // 翅膀（Stage 1+）
    if (stage >= 1) {
      const wingSpan = stage === 1 ? 25 : stage === 2 ? 50 : 65;
      const wingH = stage === 1 ? 20 : stage === 2 ? 40 : 55;

      // 左翅
      ctx.save();
      ctx.translate(-20, -10);
      ctx.rotate(-0.5 + wingFlap);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-wingSpan * 0.6, -wingH * 0.5, -wingSpan, -wingH * 0.2);
      ctx.quadraticCurveTo(-wingSpan * 0.7, wingH * 0.1, 0, 10);
      const wingGradL = ctx.createLinearGradient(0, 0, -wingSpan, 0);
      wingGradL.addColorStop(0, 'rgba(248,248,255,0.9)');
      wingGradL.addColorStop(1, 'rgba(176,196,222,0.4)');
      ctx.fillStyle = wingGradL;
      ctx.fill();
      ctx.strokeStyle = 'rgba(176,196,222,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // 右翅
      ctx.save();
      ctx.translate(20, -10);
      ctx.rotate(0.5 - wingFlap);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(wingSpan * 0.6, -wingH * 0.5, wingSpan, -wingH * 0.2);
      ctx.quadraticCurveTo(wingSpan * 0.7, wingH * 0.1, 0, 10);
      const wingGradR = ctx.createLinearGradient(0, 0, wingSpan, 0);
      wingGradR.addColorStop(0, 'rgba(248,248,255,0.9)');
      wingGradR.addColorStop(1, 'rgba(176,196,222,0.4)');
      ctx.fillStyle = wingGradR;
      ctx.fill();
      ctx.strokeStyle = 'rgba(176,196,222,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // 三角形尾鳍（Stage 2+）
    if (stage >= 2) {
      ctx.save();
      ctx.translate(0, 35);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-12, 25);
      ctx.lineTo(12, 25);
      ctx.closePath();
      ctx.fillStyle = 'rgba(248,248,255,0.7)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(176,196,222,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // 身体（流线型）
    ctx.beginPath();
    ctx.ellipse(0, 5, 30, 40, 0, 0, Math.PI * 2);
    const bodyGrad = ctx.createRadialGradient(-5, -5, 5, 0, 5, 40);
    bodyGrad.addColorStop(0, '#FFFAF0');
    bodyGrad.addColorStop(1, '#F0F0F8');
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(176,196,222,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 背部棱线
    ctx.beginPath();
    ctx.moveTo(0, -35);
    ctx.quadraticCurveTo(2, -15, 0, 20);
    ctx.strokeStyle = 'rgba(176,196,222,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 头侧凸起（Stage 2+）
    if (stage >= 2) {
      [[-22, -25], [22, -25]].forEach(([hx, hy]) => {
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#E8E8F0';
        ctx.fill();
        ctx.strokeStyle = 'rgba(176,196,222,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // 头部
    ctx.beginPath();
    ctx.ellipse(0, -20, 22, 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#F8F8FF';
    ctx.fill();

    // 蓝色猫眼竖瞳
    if (isSleepy) {
      ctx.beginPath();
      ctx.arc(-8, -22, 5, 0, Math.PI);
      ctx.moveTo(8, -22);
      ctx.arc(8, -22, 5, 0, Math.PI);
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      [-8, 8].forEach(ex => {
        // 眼白
        ctx.beginPath();
        ctx.ellipse(ex, -22, 7, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF';
        ctx.fill();
        ctx.strokeStyle = '#42A5F5';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // 蓝色虹膜
        ctx.beginPath();
        ctx.ellipse(ex, -22, 5, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#42A5F5';
        ctx.fill();
        // 竖瞳
        ctx.beginPath();
        ctx.ellipse(ex, -22, 1.5, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1A237E';
        ctx.fill();
        // 高光
        ctx.beginPath();
        ctx.arc(ex + 2, -24, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF';
        ctx.fill();
      });
    }

    // 鼻子
    ctx.beginPath();
    ctx.ellipse(0, -14, 2, 1.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#B0B0C0';
    ctx.fill();

    // 嘴
    if (mood >= 60) {
      ctx.beginPath();
      ctx.arc(0, -11, 4, 0.1, Math.PI - 0.1);
      ctx.strokeStyle = '#B0B0C0';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Stage 3 珍珠白鳞片光泽 + 微光特效
    if (stage === 3) {
      ctx.save();
      ctx.globalAlpha = 0.2 + Math.sin(time * 1.5) * 0.1;
      ctx.beginPath();
      ctx.ellipse(0, 5, 35, 45, 0, 0, Math.PI * 2);
      const glowGrad = ctx.createRadialGradient(0, 5, 10, 0, 5, 45);
      glowGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
      glowGrad.addColorStop(1, 'rgba(176,196,222,0.1)');
      ctx.fillStyle = glowGrad;
      ctx.fill();
      ctx.restore();

      // 身体边缘闪光
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(time * 3) * 0.2;
      ctx.beginPath();
      ctx.ellipse(0, 5, 32, 42, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#E3F2FD';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    if (isSleepy && stage > 0) {
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#90CAF9';
      ctx.fillText('z', 20, -40);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Z', 26, -50);
    }

    ctx.restore();
  }

  if (sick) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx + 35, cy - 50, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#EF5350';
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.fillRect(cx + 30, cy - 52, 10, 4);
    ctx.fillRect(cx + 33, cy - 55, 4, 10);
    ctx.restore();
    ctx.restore();
  }
}

// ===== 精灵绘制（4 阶段） =====
function drawFairy(ctx, stage, frame, mood, sick, isSleepy, accessories) {
  const cx = 150, cy = 155;
  const time = frame * 0.05;

  if (sick) {
    ctx.save();
    ctx.translate(Math.sin(frame * 0.5) * 2, 0);
    ctx.globalAlpha = 0.7;
  }

  if (stage === 0) {
    drawEgg(ctx, cx, cy + 20, time, '#F5F5FF', '#E6E6FA');
  } else {
    const breathe = 1 + Math.sin(time * 2) * 0.02;
    const bodyScale = stage === 1 ? 0.6 : stage === 2 ? 0.8 : 1.0;
    const floatY = stage >= 2 ? Math.sin(time * 1.5) * 8 : 0;

    ctx.save();
    ctx.translate(cx, cy + floatY);
    ctx.scale(breathe * bodyScale, breathe * bodyScale);

    // 翅膀（Stage 1+）
    if (stage >= 1) {
      const wSize = stage === 1 ? 18 : stage === 2 ? 30 : 40;
      const wingFlap = Math.sin(time * 4) * 0.3;

      // 左翅
      ctx.save();
      ctx.translate(-12, -10);
      ctx.rotate(-0.4 + wingFlap);
      ctx.globalAlpha = stage === 1 ? 0.4 : 0.6;
      ctx.beginPath();
      ctx.ellipse(-wSize * 0.5, -wSize * 0.3, wSize, wSize * 0.6, -0.2, 0, Math.PI * 2);
      const wGradL = ctx.createRadialGradient(-wSize * 0.3, -wSize * 0.2, 2, -wSize * 0.5, -wSize * 0.3, wSize);
      wGradL.addColorStop(0, 'rgba(230,230,250,0.8)');
      wGradL.addColorStop(1, 'rgba(200,180,255,0.2)');
      ctx.fillStyle = wGradL;
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,180,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Stage 2+ 翅膀花纹
      if (stage >= 2) {
        ctx.beginPath();
        ctx.ellipse(-wSize * 0.4, -wSize * 0.2, wSize * 0.5, wSize * 0.3, -0.2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(180,160,230,0.4)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // 右翅
      ctx.save();
      ctx.translate(12, -10);
      ctx.rotate(0.4 - wingFlap);
      ctx.globalAlpha = stage === 1 ? 0.4 : 0.6;
      ctx.beginPath();
      ctx.ellipse(wSize * 0.5, -wSize * 0.3, wSize, wSize * 0.6, 0.2, 0, Math.PI * 2);
      const wGradR = ctx.createRadialGradient(wSize * 0.3, -wSize * 0.2, 2, wSize * 0.5, -wSize * 0.3, wSize);
      wGradR.addColorStop(0, 'rgba(230,230,250,0.8)');
      wGradR.addColorStop(1, 'rgba(200,180,255,0.2)');
      ctx.fillStyle = wGradR;
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,180,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (stage >= 2) {
        ctx.beginPath();
        ctx.ellipse(wSize * 0.4, -wSize * 0.2, wSize * 0.5, wSize * 0.3, 0.2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(180,160,230,0.4)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // 身体
    ctx.beginPath();
    ctx.ellipse(0, 8, 18, 25, 0, 0, Math.PI * 2);
    const fairyGrad = ctx.createRadialGradient(-3, 0, 3, 0, 8, 25);
    fairyGrad.addColorStop(0, '#FFFDE7');
    fairyGrad.addColorStop(1, '#E6E6FA');
    ctx.fillStyle = fairyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,180,255,0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 头
    ctx.beginPath();
    ctx.arc(0, -20, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFDE7';
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,180,255,0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 头发（小卷发）
    ctx.fillStyle = '#B39DDB';
    [[-14, -32, 5], [-8, -36, 4], [0, -38, 5], [8, -36, 4], [14, -32, 5]].forEach(([hx, hy, r]) => {
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 眼睛
    if (isSleepy) {
      ctx.beginPath();
      ctx.arc(-6, -20, 4, 0, Math.PI);
      ctx.moveTo(6, -20);
      ctx.arc(6, -20, 4, 0, Math.PI);
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      [-6, 6].forEach(ex => {
        ctx.beginPath();
        ctx.arc(ex, -20, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF';
        ctx.fill();
        ctx.strokeStyle = '#7E57C2';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ex, -19, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#7E57C2';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + 1, -21, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF';
        ctx.fill();
      });
    }

    // 嘴
    if (mood >= 60) {
      ctx.beginPath();
      ctx.arc(0, -14, 3, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 小脚
    ctx.beginPath();
    ctx.ellipse(-8, 32, 5, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(8, 32, 5, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#E6E6FA';
    ctx.fill();

    // 微光（Stage 1+）
    ctx.save();
    ctx.globalAlpha = 0.1 + Math.sin(time * 2) * 0.08;
    ctx.beginPath();
    ctx.arc(0, 0, 35 + Math.sin(time) * 3, 0, Math.PI * 2);
    ctx.fillStyle = '#E1BEE7';
    ctx.fill();
    ctx.restore();

    // Stage 3 粒子特效
    if (stage === 3) {
      for (let i = 0; i < 6; i++) {
        const angle = (time * 0.5 + i * Math.PI / 3) % (Math.PI * 2);
        const dist = 30 + Math.sin(time * 2 + i) * 10;
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist - 10;
        const pSize = 2 + Math.sin(time * 3 + i) * 1;
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(time * 2 + i) * 0.2;
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, Math.PI * 2);
        ctx.fillStyle = '#CE93D8';
        ctx.fill();
        ctx.restore();
      }
    }

    if (isSleepy && stage > 0) {
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#90CAF9';
      ctx.fillText('z', 15, -32);
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('Z', 20, -42);
    }

    ctx.restore();
  }

  if (sick) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx + 25, cy - 45, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#EF5350';
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.fillRect(cx + 20, cy - 47, 10, 4);
    ctx.fillRect(cx + 23, cy - 50, 4, 10);
    ctx.restore();
    ctx.restore();
  }
}

// ===== 章鱼绘制（4 阶段） =====
function drawOctopus(ctx, stage, frame, mood, sick, isSleepy, accessories) {
  const cx = 150, cy = 155;
  const time = frame * 0.05;

  if (sick) {
    ctx.save();
    ctx.translate(Math.sin(frame * 0.5) * 2, 0);
    ctx.globalAlpha = 0.7;
  }

  if (stage === 0) {
    drawEgg(ctx, cx, cy + 15, time, '#F3E5F5', '#DDA0DD');
  } else {
    const breathe = 1 + Math.sin(time * 2) * 0.02;
    const bodyScale = stage === 1 ? 0.6 : stage === 2 ? 0.8 : 1.0;
    // 触手数量
    const tentacleCount = stage === 1 ? 4 : stage === 2 ? 6 : 8;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(breathe * bodyScale, breathe * bodyScale);

    // 触手
    for (let i = 0; i < tentacleCount; i++) {
      const baseAngle = (i / tentacleCount) * Math.PI + Math.PI * 0.05;
      const wave = Math.sin(time * 2 + i * 0.8) * 0.2;
      const tentLen = stage === 1 ? 30 : stage === 2 ? 45 : 55;

      ctx.save();
      ctx.rotate(baseAngle + wave);
      ctx.beginPath();
      ctx.moveTo(0, 20);
      const segments = 6;
      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        const sx = Math.sin(time * 2 + i + s * 0.5) * (10 + s * 3);
        const sy = 20 + t * tentLen;
        ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = '#CE93D8';
      ctx.lineWidth = stage === 1 ? 8 : stage === 2 ? 7 : 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Stage 2+ 吸盘
      if (stage >= 2) {
        for (let s = 2; s <= segments; s += 2) {
          const t = s / segments;
          const sx = Math.sin(time * 2 + i + s * 0.5) * (10 + s * 3);
          const sy = 20 + t * tentLen;
          ctx.beginPath();
          ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#E1BEE7';
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Stage 3 墨汁喷射动画
    if (stage === 3 && Math.sin(time * 0.3) > 0.95) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      const inkPhase = (time * 0.3 % 1) * 10;
      ctx.beginPath();
      ctx.arc(0, 60 + inkPhase * 5, 8 + inkPhase * 2, 0, Math.PI * 2);
      ctx.fillStyle = '#4A148C';
      ctx.fill();
      ctx.restore();
    }

    // 头（圆头）
    ctx.beginPath();
    ctx.ellipse(0, -5, 32, 30, 0, Math.PI, 0); // 半圆顶
    ctx.ellipse(0, -5, 32, 10, 0, 0, Math.PI); // 平底
    const headGrad = ctx.createRadialGradient(-5, -15, 5, 0, -5, 32);
    headGrad.addColorStop(0, '#E1BEE7');
    headGrad.addColorStop(1, '#CE93D8');
    ctx.fillStyle = headGrad;
    ctx.fill();
    ctx.strokeStyle = '#AB47BC';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 头顶斑点
    [[-12, -28, 4], [8, -30, 3], [-3, -33, 3]].forEach(([sx, sy, sr]) => {
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(171,71,188,0.3)';
      ctx.fill();
    });

    // 眼睛
    if (isSleepy) {
      ctx.beginPath();
      ctx.arc(-10, -8, 6, 0, Math.PI);
      ctx.moveTo(10, -8);
      ctx.arc(10, -8, 6, 0, Math.PI);
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      [-10, 10].forEach(ex => {
        ctx.beginPath();
        ctx.arc(ex, -8, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF';
        ctx.fill();
        ctx.strokeStyle = '#5D4037';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ex, -6, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#4A148C';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + 1.5, -8, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF';
        ctx.fill();
      });
    }

    // 嘴
    ctx.beginPath();
    ctx.ellipse(0, 2, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#AB47BC';
    ctx.fill();

    if (isSleepy && stage > 0) {
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#90CAF9';
      ctx.fillText('z', 22, -25);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Z', 28, -35);
    }

    ctx.restore();
  }

  if (sick) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx + 30, cy - 45, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#EF5350';
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.fillRect(cx + 25, cy - 47, 10, 4);
    ctx.fillRect(cx + 28, cy - 50, 4, 10);
    ctx.restore();
    ctx.restore();
  }
}

// ===== 监听事件 =====
window.bus.on('page:enter', (pageName) => {
  if (pageName === 'pet') {
    renderPetPage();
  }
});

window.bus.on('page:leave', (pageName) => {
  if (pageName === 'pet') {
    stopCanvasAnimation();
  }
});

window.bus.on('data:changed', (key) => {
  // 数据变化时更新宠物页面
  if (key && (key.includes('pets') || key.includes('hunger') || key.includes('mood') || key.includes('energy') || key.includes('exp'))) {
    const pet = window.store.getActivePet();
    if (pet) {
      updateExpBar(pet);
      updateStatRings(pet);
    }
  }
});

window.bus.on('pet:evolved', (pet) => {
  const petType = PET_TYPES[pet.type];
  showToast(`🎉 ${pet.name} 进化成${STAGE_NAMES[pet.stage]}了！`, 'success');
  // 重新渲染
  if (document.getElementById('pet-canvas')) {
    renderPetPage();
  }
});

window.bus.on('pet:sick', (pet) => {
  showToast(`哦不！${pet.name} 生病了！快完成任务帮它恢复~`, 'warning');
});

window.bus.on('pet:healed', (pet) => {
  showToast(`太好了！${pet.name} 痊愈了！🎉`, 'success');
});
