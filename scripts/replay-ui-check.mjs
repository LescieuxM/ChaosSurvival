import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
export async function verifyReplayUI({
  evaluate,
  until,
  wait,
  command,
  restart,
  outputDirectory,
  openBeforeArrival = false,
}) {
  // Only used with disposable Electron/portable QA profiles.
  await until(
    () =>
      evaluate("!!document.querySelector('#return-main-menu')&&!!window.chaosDebug").catch(
        () => false,
      ),
    'ready for replay QA',
  );
  if (await evaluate("!!localStorage.getItem('chaos-survival-story-v1')")) {
    await evaluate(
      "document.querySelector('#return-main-menu').click();localStorage.removeItem('chaos-survival-story-v1');localStorage.removeItem('chaos-survival-history-v1');window.__replayReset=true",
    );
    await command('Page.reload');
    await until(
      () =>
        evaluate("window.__replayReset!==true&&window.chaosDebug?.snapshot().phase==='menu'").catch(
          () => false,
        ),
      'fresh replay QA profile',
    );
  }
  const saved = () => evaluate("JSON.parse(localStorage.getItem('chaos-survival-story-v1'))");
  await until(
    () => evaluate("window.chaosDebug?.snapshot().phase==='menu'").catch(() => false),
    'menu',
  );
  await evaluate("document.querySelector('#menu-play').click()");
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='playing'"), 'first launch');
  assert.equal((await saved()).level1Launches, 1);
  // Test fixture lives exclusively in a disposable QA profile.
  const intro = JSON.parse(
    readFileSync(new URL('../src/dialogues/pixelgirl-intro.json', import.meta.url), 'utf8'),
  );
  const introState = {
    node: 'first-contact',
    cursor: 4,
    revision: 2,
    finished: false,
    transcript: intro.nodes['first-contact'].messages.map((message) => ({
      speaker: message.speaker,
      text: message.text,
      receivedAt: 1,
    })),
  };
  await evaluate(
    `document.querySelector('#return-main-menu').click();const s=JSON.parse(localStorage.getItem('chaos-survival-story-v1'));s.current='pixelgirl-hello';s.completed=['arcade-1'];s.unlockedConversations=['pixelgirl-intro'];s.dialogues['pixelgirl-intro']=${JSON.stringify(introState)};localStorage.setItem('chaos-survival-story-v1',JSON.stringify(s));window.__reload=true;`,
  );
  await command('Page.reload');
  await until(
    () =>
      evaluate("window.__reload!==true&&window.chaosDebug?.snapshot().phase==='menu'").catch(
        () => false,
      ),
    'reloaded',
  );
  await evaluate("document.querySelector('#menu-play').click();");
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='desktop'"), 'desktop');
  await evaluate(
    "document.querySelector('[data-shortcut=music]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))",
  );
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='playing'"), 'replay');
  const attempt = (await saved()).replayReactions.at(-1);
  assert.equal(attempt.dueAt - attempt.launchedAt, 2000);
  await wait(1400);
  assert.equal((await saved()).dialogues[attempt.id], undefined);
  let existingWindow;
  if (openBeforeArrival) {
    await evaluate(
      "document.querySelector('#windows-start').click();document.querySelector('#menu-messenger').click()",
    );
    await until(
      () => evaluate("!!document.querySelector('.popup-narrative')"),
      'open before arrival',
    );
    existingWindow = await evaluate("document.querySelector('.popup-narrative').dataset.windowId");
  }
  await until(() => saved().then((data) => !!data.dialogues[attempt.id]), 'notification', 2500);
  const firstMessage = (await saved()).dialogues[attempt.id].transcript[0];
  assert.ok(firstMessage.receivedAt - attempt.launchedAt >= 2000);
  assert.ok(firstMessage.receivedAt - attempt.launchedAt < 3000);
  if (openBeforeArrival) {
    assert.equal(await evaluate("document.querySelectorAll('.popup-narrative').length"), 1);
    assert.equal(
      await evaluate("document.querySelector('.popup-narrative').dataset.windowId"),
      existingWindow,
    );
  } else {
    assert.equal((await evaluate('window.chaosDebug.snapshot()')).phase, 'playing');
    assert.equal(await evaluate("!!document.querySelector('.popup-narrative')"), false);
    assert.equal(await evaluate("document.querySelector('#toast-open').hidden"), false);
    await evaluate("document.querySelector('#toast-open').click()");
  }
  await until(() => evaluate("!!document.querySelector('[data-choice-id=greeting-1]')"), 'choices');
  assert.equal(await evaluate("!!document.querySelector('.popup-narrative select')"), false);
  assert.ok(
    await evaluate("!!document.querySelector('.dialogue-choices [data-choice-id=greeting-1]')"),
  );
  assert.ok(
    await evaluate("!!document.querySelector('.dialogue-choices [data-choice-id=greeting-1]')"),
  );
  assert.equal((await evaluate('window.chaosDebug.snapshot()')).phase, 'paused');
  const before = await saved();
  await evaluate(
    "document.querySelector('.popup-narrative .close-button').click();document.querySelector('#return-main-menu').click()",
  );
  await restart();
  await until(
    () => evaluate("window.chaosDebug?.snapshot().phase==='menu'").catch(() => false),
    'native relaunch',
  );
  assert.deepEqual(
    (await saved()).conversations.pixelgirl.history,
    before.conversations.pixelgirl.history,
  );
  await evaluate("document.querySelector('#menu-play').click()");
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='desktop'"), 'restored desktop');
  await evaluate(
    "document.querySelector('[data-shortcut=music]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))",
  );
  await until(
    () => evaluate("window.chaosDebug.snapshot().phase==='playing'"),
    'abandoned replay counted',
  );
  await evaluate(
    "document.querySelector('#windows-start').click();document.querySelector('#menu-messenger').click()",
  );
  await until(
    () => evaluate("!!document.querySelector('[data-choice-id=greeting-1]')"),
    'restored choices',
  );
  const windowId = await evaluate("document.querySelector('.popup-narrative').dataset.windowId");
  await until(
    () =>
      evaluate(
        "!document.querySelector('.dialogue-typing').textContent.includes('en train') && document.querySelector('.conversation-log').textContent.includes('ENCORE ???')",
      ),
    'replay sequence delivered',
  );
  assert.ok(
    await evaluate("!!document.querySelector('[data-choice-id=greeting-1]:not(:disabled)')"),
  );
  assert.equal(
    await evaluate(
      "document.querySelector('.conversation-log').textContent.includes('ENCORE ???')",
    ),
    true,
  );
  assert.ok(
    await evaluate("!!document.querySelector('.dialogue-choices [data-choice-id=greeting-1]')"),
  );
  assert.ok(
    await evaluate("!!document.querySelector('.dialogue-choices [data-choice-id=greeting-1]')"),
  );
  assert.equal(
    await evaluate("document.querySelectorAll('.conversation-log .dialogue-choice').length"),
    0,
  );
  assert.equal(
    await evaluate("!!document.querySelector('[data-choice-id=replay-olympics]')"),
    false,
  );
  assert.equal(
    await evaluate("document.querySelector('.popup-narrative').dataset.windowId"),
    windowId,
  );
  assert.equal(
    await evaluate("document.querySelectorAll('.conversation-message').length"),
    (await saved()).conversations.pixelgirl.history.length,
  );
  assert.ok(
    await evaluate("!!document.querySelector('.dialogue-choices [data-choice-id=greeting-1]')"),
  );
  assert.deepEqual((await saved()).dialogues['pixelgirl-intro'].transcript, introState.transcript);
  await wait(300);
  await evaluate(
    "document.querySelector('.popup-narrative .close-button').click();document.querySelector('#dialog-action').click()",
  );
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='playing'"), 'resume');
  await evaluate(
    "document.querySelector('[data-shortcut=music]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))",
  );
  await until(
    () =>
      evaluate(
        "window.chaosDebug.snapshot().phase==='playing' && window.chaosDebug.snapshot().launches===4",
      ),
    'third replay',
  );
  await evaluate(
    "document.querySelector('#windows-start').click();document.querySelector('#menu-messenger').click()",
  );
  await until(() => evaluate("!!document.querySelector('.popup-narrative')"), 'open messenger');
  await evaluate(
    "document.querySelector('.msn-minimize').click();document.querySelector('#dialog-action').click()",
  );
  await until(
    () =>
      evaluate(
        "document.querySelector('.conversation-log').textContent.includes('tu dors des fois')",
      ),
    'minimized message',
    8000,
  );
  assert.ok(await evaluate("document.querySelector('.popup-narrative').hidden"));
  assert.equal((await evaluate('window.chaosDebug.snapshot()')).phase, 'playing');
  await evaluate(
    'document.querySelector(\'[data-app="messenger:conversation:pixelgirl"]\').click()',
  );
  assert.equal(await evaluate("document.querySelectorAll('.popup-narrative').length"), 1);
  assert.equal((await saved()).current, 'pixelgirl-hello');
  assert.equal(await evaluate("!!document.querySelector('.popup-narrative select')"), false);
  const shot = await command('Page.captureScreenshot');
  await writeFile(
    `${outputDirectory}/single-pixelgirl-discussion.png`,
    Buffer.from(shot.data, 'base64'),
  );
  await evaluate(
    "document.querySelector('#return-main-menu').click();document.querySelector('#menu-new-game').click();document.querySelector('#menu-confirm-yes').click()",
  );
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='playing'"), 'new game');
  await evaluate(
    "document.querySelector('#windows-start').click();document.querySelector('#menu-messenger').click()",
  );
  await until(
    () =>
      evaluate(
        "!!document.querySelector('.messenger-contact-list') && !document.querySelector('[data-contact-id=pixelgirl]')",
      ),
    'locked contacts after new game',
  );
  assert.deepEqual((await saved()).conversations.pixelgirl.history, []);
  return {
    notifications: true,
    messageOnlyReplays: true,
    minimized: true,
    noAutomaticPause: true,
    queuedChoices: true,
    nativeRelaunch: true,
    singleHistory: true,
  };
}
