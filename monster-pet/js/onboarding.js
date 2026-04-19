/**
 * 首次打开引导流程
 */

(function initOnboarding() {
  function showOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    showStep(1);
  }

  function showStep(stepNum) {
    // 隐藏所有步骤
    document.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
    // 显示当前步骤
    const step = document.getElementById(`onboarding-step-${stepNum}`);
    if (step) step.classList.add('active');
  }

  function hideOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.classList.add('hidden');
    window.store.set('onboardingDone', true);
  }

  // 等待 DOM 和 store 都准备好
  function waitForReady() {
    if (window.store && document.getElementById('onboarding-overlay')) {
      startOnboarding();
    } else {
      setTimeout(waitForReady, 100);
    }
  }

  function startOnboarding() {
    // 检查是否已完成引导
    if (window.store.get('onboardingDone')) {
      hideOnboarding();
      return;
    }

    showOnboarding();

    // Step 1: 输入宠物名字
    const nameInput = document.getElementById('pet-name-input');
    const nextBtn1 = document.getElementById('onboarding-next-1');

    if (nextBtn1) {
      nextBtn1.addEventListener('click', () => {
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
          nameInput.style.borderColor = '#FF6B6B';
          nameInput.placeholder = '请输入一个名字哦~';
          nameInput.focus();
          return;
        }

        // 保存宠物名字（直接操作数组，不用点号路径）
        const pets = window.store.get('pets');
        if (pets && pets[0]) {
          pets[0].name = name;
          window.store.set('pets', pets);
        }
        window.store.set('user.name', name);
        showStep(2);
      });
    }

    // 回车键下一步
    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          nextBtn1 && nextBtn1.click();
        }
      });
    }

    // Step 2: 完成
    const nextBtn2 = document.getElementById('onboarding-next-2');
    if (nextBtn2) {
      nextBtn2.addEventListener('click', () => {
        hideOnboarding();
        // 触发页面初始化事件
        window.bus.emit('onboarding:done');
        window.bus.emit('page:enter', 'pet');
        showToast(`${window.store.get('pets[0].name')} 开始冒险啦！🎉`);
      });
    }
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForReady);
  } else {
    waitForReady();
  }
})();
