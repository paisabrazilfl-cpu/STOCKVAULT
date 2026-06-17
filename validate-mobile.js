const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.createContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)'
  });
  
  const page = await context.newPage();
  console.log('📱 Mobile Validation (390x844)\n');
  
  // Main page
  await page.goto('https://stockvault-web.onrender.com?v=2');
  const darkMode = await page.locator('html').evaluate(el => el.className.includes('dark'));
  console.log(`✅ Main page loaded | Dark mode: ${darkMode ? '✓' : '✗'}`);
  
  const mainBodyWidth = await page.evaluate(() => document.body.scrollWidth);
  console.log(`📏 Body width: ${mainBodyWidth}px (overflow: ${mainBodyWidth > 400 ? '✗' : '✓'})`);
  
  await page.screenshot({ path: '/tmp/mobile-main.png', fullPage: true });
  
  // FPTM page
  console.log('\nFPTM Page:');
  await page.goto('https://stockvault-web.onrender.com/fptm?v=2');
  const fptmBodyWidth = await page.evaluate(() => document.body.scrollWidth);
  console.log(`✅ FPTM loaded | Body width: ${fptmBodyWidth}px (overflow: ${fptmBodyWidth > 400 ? '✗' : '✓'})`);
  
  // Check button sizes
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).slice(0, 5).map(b => ({
      width: b.offsetWidth,
      height: b.offsetHeight,
      text: b.textContent?.substring(0, 20)
    }));
  });
  
  console.log('\nButton sizes:');
  buttons.forEach((btn, i) => {
    const status = btn.width < 44 ? '⚠️  TIGHT' : '✅';
    console.log(`  ${status} ${btn.width}x${btn.height}px: "${btn.text}"`);
  });
  
  await page.screenshot({ path: '/tmp/mobile-fptm.png', fullPage: true });
  console.log('\n✅ Screenshots saved to /tmp/mobile-*.png');
  
  await browser.close();
})();
