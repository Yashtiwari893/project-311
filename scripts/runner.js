/**
 * LinkedFlow India — Extended LinkedIn Playwright Runner
 * Supports: connect, send_message, profile_update, inmail, scrape_leads
 */
const { chromium } = require('playwright');
const crypto       = require('crypto');

const { JOB_ID, ACTION_TYPE, LI_AT_COOKIE, TARGET_URL, MESSAGE, CAMPAIGN_ID, LEAD_ID, WEBHOOK_URL, WEBHOOK_SECRET } = process.env;

async function notify(status, result = '', error = '') {
  const body = JSON.stringify({ event: 'job.completed', payload: { job_id: JOB_ID, campaign_id: CAMPAIGN_ID, lead_id: LEAD_ID, status, result, error } });
  const sig  = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig }, body }).catch(console.error);
}

const delay      = ms => new Promise(r => setTimeout(r, ms));
const humanDelay = (min = 1500, max = 3500) => delay(Math.random() * (max - min) + min);

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36', viewport: { width: 1280, height: 800 }, locale: 'en-IN' });
  await context.addCookies([{ name: 'li_at', value: LI_AT_COOKIE, domain: '.linkedin.com', path: '/', httpOnly: true, secure: true }]);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    const url = page.url();
    if (url.includes('/login') || url.includes('/checkpoint')) throw new Error('LinkedIn session expired. Please reconnect your account.');

    if (ACTION_TYPE === 'connect')        await sendConnectionRequest(page);
    else if (ACTION_TYPE === 'send_message')   await sendMessage(page);
    else if (ACTION_TYPE === 'profile_update') await updateProfile(page);
    else if (ACTION_TYPE === 'inmail')         await sendInMail(page);
    else if (ACTION_TYPE === 'scrape_leads')   await scrapeLeads(page);
    else throw new Error(`Unknown action: ${ACTION_TYPE}`);
  } catch (err) {
    await notify('failed', '', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

async function sendConnectionRequest(page) {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await humanDelay();
  const connectBtn = page.locator('button:has-text("Connect")').first();
  let connected = await connectBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (connected) { await connectBtn.click(); }
  else {
    const moreBtn = page.locator('button:has-text("More")').first();
    if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moreBtn.click(); await humanDelay(800, 1500);
      const menuConnect = page.locator('[aria-label*="Connect"]');
      if (await menuConnect.isVisible({ timeout: 2000 }).catch(() => false)) { await menuConnect.click(); connected = true; }
    }
  }
  if (!connected) throw new Error('Connect button not found');
  await humanDelay(800, 1500);
  if (MESSAGE) {
    const noteBtn = page.locator('button:has-text("Add a note")');
    if (await noteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await noteBtn.click(); await humanDelay();
      const msgArea = page.locator('textarea[name="message"]');
      await msgArea.type(MESSAGE, { delay: 30 });
      await humanDelay(500, 1000);
    }
  }
  const sendBtn = page.locator('button:has-text("Send")').last();
  await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
  await sendBtn.click(); await humanDelay();
  await notify('done', 'Connection request sent');
  console.log('Connection request sent to:', TARGET_URL);
}

async function sendMessage(page) {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' }); await humanDelay();
  const msgBtn = page.locator('button:has-text("Message")').first();
  if (!await msgBtn.isVisible({ timeout: 5000 }).catch(() => false)) throw new Error('Message button not found');
  await msgBtn.click(); await humanDelay();
  const msgBox = page.locator('.msg-form__contenteditable').first();
  await msgBox.waitFor({ state: 'visible', timeout: 5000 });
  await msgBox.click();
  for (const char of MESSAGE.split('')) { await page.keyboard.type(char); await delay(Math.random() * 50 + 15); }
  await humanDelay(800, 1500);
  await page.keyboard.press('Control+Enter'); await humanDelay();
  await notify('done', 'Message sent');
  console.log('Message sent to:', TARGET_URL);
}

async function updateProfile(page) {
  const updates = JSON.parse(MESSAGE || '{}');
  const results = [];
  if (updates.headline) {
    await page.goto('https://www.linkedin.com/in/me/', { waitUntil: 'domcontentloaded' }); await humanDelay(2000, 3000);
    const editBtn = page.locator('[aria-label="Edit intro"]').first();
    if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.click(); await humanDelay(1500, 2500);
      const headlineInput = page.locator('input[name="headline"]').first();
      if (await headlineInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await headlineInput.fill(updates.headline);
        const saveBtn = page.locator('button:has-text("Save")').last();
        await saveBtn.click(); await humanDelay(2000, 3000);
        results.push('headline');
      }
    }
  }
  if (updates.about) {
    await page.goto('https://www.linkedin.com/in/me/', { waitUntil: 'domcontentloaded' }); await humanDelay(2000, 3000);
    const aboutEditBtn = page.locator('[aria-label*="Edit about"]').first();
    if (await aboutEditBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await aboutEditBtn.click(); await humanDelay(1500, 2500);
      const aboutArea = page.locator('textarea[name="summary"]').first();
      if (await aboutArea.isVisible({ timeout: 3000 }).catch(() => false)) {
        await aboutArea.fill(updates.about);
        const saveBtn = page.locator('button:has-text("Save")').last();
        await saveBtn.click(); await humanDelay(2000, 3000);
        results.push('about');
      }
    }
  }
  if (updates.posts && updates.posts[0]) {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' }); await humanDelay(2000, 3000);
    const startPost = page.locator('button:has-text("Start a post")').first();
    if (await startPost.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startPost.click(); await humanDelay(1500, 2500);
      const postEditor = page.locator('[aria-label="Text editor for creating content"]').first();
      if (await postEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await postEditor.type(updates.posts[0], { delay: 20 }); await humanDelay(1500, 2500);
        const postBtn = page.locator('button:has-text("Post")').last();
        if (await postBtn.isEnabled({ timeout: 3000 }).catch(() => false)) { await postBtn.click(); results.push('post'); }
      }
    }
  }
  await notify('done', JSON.stringify({ updated: results }));
  console.log('Profile updated:', results.join(', '));
}

async function sendInMail(page) {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' }); await humanDelay();
  const inmailBtn = page.locator('button:has-text("InMail")').first();
  if (!await inmailBtn.isVisible({ timeout: 5000 }).catch(() => false)) throw new Error('InMail not available (requires Premium)');
  await inmailBtn.click(); await humanDelay(1500, 2500);
  const bodyArea = page.locator('.msg-form__contenteditable').first();
  await bodyArea.click(); await bodyArea.type(MESSAGE, { delay: 25 }); await humanDelay();
  await page.locator('button:has-text("Send")').last().click(); await humanDelay();
  await notify('done', 'InMail sent');
}

async function scrapeLeads(page) {
  if (!TARGET_URL) { await notify('done', '[]'); return; }
  const urls = TARGET_URL.split(',').slice(0, 30);
  const results = [];
  for (const url of urls) {
    try {
      await page.goto(url.trim(), { waitUntil: 'domcontentloaded', timeout: 25000 }); await humanDelay(1500, 3000);
      const name    = await page.locator('h1').first().textContent().catch(() => '');
      const title   = await page.locator('.text-body-medium.break-words').first().textContent().catch(() => '');
      const company = await page.locator('.pv-text-details__right-panel span').first().textContent().catch(() => '');
      const loc     = await page.locator('.pv-text-details__left-panel .text-body-small').first().textContent().catch(() => '');
      const pic     = await page.locator('.pv-top-card-profile-picture img').first().getAttribute('src').catch(() => '');
      results.push({ linkedin_url: url.trim(), name: name?.trim(), title: title?.trim(), company: company?.trim(), location: loc?.trim(), profile_pic_url: pic });
    } catch (e) { results.push({ linkedin_url: url.trim(), error: e.message }); }
    await delay(Math.random() * 3000 + 3000);
  }
  await notify('done', JSON.stringify(results));
  console.log('Scraped', results.length, 'profiles');
}

main();
