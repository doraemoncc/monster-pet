/* ===== 诊断脚本：复制到浏览器控制台运行 ===== */

(function() {
  // 获取所有页面的计算样式
  const pages = {
    'pet': document.getElementById('page-pet'),
    'tasks': document.getElementById('page-tasks'),
    'shop': document.getElementById('page-shop'),
    'parent': document.getElementById('page-parent')
  };

  console.log('========== 页面顶部空白诊断 ==========');

  // 1. CSS 变量
  const rootStyle = getComputedStyle(document.documentElement);
  console.log('\n[CSS Variables]');
  console.log('--safe-top:', rootStyle.getPropertyValue('--safe-top').trim());
  console.log('--nav-height:', rootStyle.getPropertyValue('--nav-height').trim());

  // 2. 各页面计算样式
  console.log('\n[Computed Styles]');
  for (const [name, el] of Object.entries(pages)) {
    const cs = getComputedStyle(el);
    console.log(`#page-${name}:`);
    console.log(`  display: ${cs.display}`);
    console.log(`  padding: ${cs.padding}`);
    console.log(`  padding-top: ${cs.paddingTop}`);
    console.log(`  padding-bottom: ${cs.paddingBottom}`);
    console.log(`  min-height: ${cs.minHeight}`);
    console.log(`  margin: ${cs.margin}`);
  }

  // 3. Body 样式
  const bodyCS = getComputedStyle(document.body);
  console.log('\n[Body]');
  console.log(`  padding-top: ${bodyCS.paddingTop}`);
  console.log(`  padding-bottom: ${bodyCS.paddingBottom}`);
  console.log(`  margin-top: ${bodyCS.marginTop}`);

  // 4. 找到实际空白来源
  console.log('\n[空白分析]');
  for (const [name, el] of Object.entries(pages)) {
    if (el.firstElementChild) {
      const pageRect = el.getBoundingClientRect();
      const childRect = el.firstElementChild.getBoundingClientRect();
      const gap = childRect.top - pageRect.top;
      const pagePaddingTop = parseFloat(getComputedStyle(el).paddingTop);
      console.log(`#page-${name}: 页面顶部到第一个子元素 = ${gap.toFixed(1)}px (padding-top = ${pagePaddingTop}px, extra gap = ${(gap - pagePaddingTop).toFixed(1)}px)`);
      console.log(`  第一个子元素: <${el.firstElementChild.tagName.toLowerCase()}.${el.firstElementChild.className}>`);
      if (gap - pagePaddingTop > 2) {
        console.log(`  ⚠️ 多余 ${gap - pagePaddingTop}px 的间距！可能来自 margin 或其他布局属性`);
        // 检查子元素的 margin
        const childCS = getComputedStyle(el.firstElementChild);
        console.log(`  子元素 margin-top: ${childCS.marginTop}`);
        console.log(`  子元素 padding-top: ${childCS.paddingTop}`);
      }
    } else {
      console.log(`#page-${name}: ⚠️ 无子元素！页面是空的！`);
    }
  }

  // 5. 检查是否有固定的元素在页面上方
  const fixedEls = document.querySelectorAll('*');
  let fixedAbove = [];
  fixedEls.forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.position === 'sticky') {
      const rect = el.getBoundingClientRect();
      if (rect.top < 100 && rect.height < 100) {
        fixedAbove.push({
          tag: el.tagName,
          cls: el.className,
          top: rect.top,
          height: rect.height,
          pos: cs.position,
          zIndex: cs.zIndex
        });
      }
    }
  });
  if (fixedAbove.length > 0) {
    console.log('\n[页面上方固定/粘性元素]');
    fixedAbove.forEach(el => console.log(`  <${el.tag}.${el.cls}> top=${el.top}px height=${el.height}px ${el.pos} z=${el.zIndex}`));
  }

  console.log('\n========== 诊断完成 ==========');
})();
