import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function verifyStoryUI({
  evaluate,
  command,
  until,
  wait,
  outputDirectory,
  victory = false,
}) {
  const capture = async (name) => {
    const image = await command('Page.captureScreenshot');
    await writeFile(path.join(outputDirectory, name), Buffer.from(image.data, 'base64'));
  };
  const saved = () => evaluate("JSON.parse(localStorage.getItem('chaos-survival-story-v1'))");
  if (victory) {
    assert.ok(await evaluate("!!document.querySelector('#victory-layer')"));
    await wait(650);
    await capture('victory.png');
    await evaluate("document.querySelector('#victory-continue').click()");
  }
  await until(
    () => evaluate("document.querySelector('#desktop').classList.contains('story-desktop')"),
    'desktop',
  );
  await until(
    () => evaluate("!document.querySelector('#toast-open').hidden"),
    'PixelGirl connected',
  );
  assert.ok(
    (await evaluate("document.querySelector('#toast-contact').textContent")).includes(
      'xX_PixelGirl_Xx',
    ),
  );
  await wait(2200);
  assert.ok(
    (await evaluate("document.querySelector('#toast-message').textContent")).includes(
      'nouveau message',
    ),
  );
  await evaluate("document.querySelector('#toast-open').click()");
  await until(() => evaluate("!!document.querySelector('.popup-narrative')"), 'MSN window');
  assert.equal(
    await evaluate("!!document.querySelector('.conversation-channel, .popup-narrative select')"),
    false,
  );
  assert.equal(await evaluate("!!document.querySelector('#pause-messages')"), false);
  await until(
    () => evaluate("!!document.querySelector('[data-choice-id=greeting-1]')"),
    'first choice',
    12000,
  );
  await wait(1200);
  assert.equal((await saved()).choices.length, 0);
  const offers = (await saved()).choiceOffers['pixelgirl-intro:first-contact'];
  assert.equal(offers.length, 3);
  await evaluate("document.querySelector('[data-choice-id=greeting-1]').click()");
  assert.ok(await evaluate("!!document.querySelector('.dialogue-echo')"));
  const ghost = await evaluate("document.querySelector('.dialogue-echo').textContent");
  assert.ok(ghost.includes('au hasard'));
  await wait(150);
  assert.ok(await evaluate("!!document.querySelector('.dialogue-echo')"));
  await wait(600);
  assert.equal(await evaluate("!!document.querySelector('.dialogue-echo')"), false);
  assert.equal(
    (await saved()).dialogues['pixelgirl-intro'].transcript.filter(
      (message) => message.speaker === 'player',
    ).length,
    1,
  );
  await until(
    () =>
      evaluate("document.querySelector('.dialogue-typing').textContent.includes('est en train')"),
    'typing',
    5000,
  );
  console.log(
    'OK : messages automatiques, choix en attente, trois propositions conservées et anomalie visuelle de 500 ms.',
  );
  await until(
    () => evaluate("!!document.querySelector('[data-choice-id=nickname-3]')"),
    'presentation choices',
    20000,
  );
  await evaluate('window.__storyReload=true');
  await command('Page.reload');
  await until(
    () =>
      evaluate(
        "window.__storyReload!==true&&document.readyState==='complete'&&window.chaosDebug?.snapshot().phase==='menu'",
      ).catch(() => false),
    'reload',
  );
  await evaluate("document.querySelector('#menu-play').click()");
  await until(
    () => evaluate("!!document.querySelector('.popup-narrative')"),
    'conversation reprise depuis le menu',
  );
  assert.equal(await evaluate("!!document.querySelector('.dialogue-echo')"), false);
  await until(
    () => evaluate("!!document.querySelector('[data-choice-id=nickname-3]')"),
    'restored choices',
  );
  const restored = await saved();
  await evaluate("document.querySelector('.msn-minimize').click()");
  assert.equal(await evaluate("document.querySelector('#msn-task').hidden"), false);
  await evaluate(
    "document.querySelector('#msn-task').click();document.querySelector('.popup-narrative .close-button').click()",
  );
  assert.equal(await evaluate("document.querySelector('#msn-task').hidden"), true);
  assert.deepEqual((await saved()).choices, restored.choices);
  await evaluate(
    "document.querySelector('#windows-start').click();document.querySelector('#menu-messenger').click()",
  );
  await until(
    () => evaluate("!!document.querySelector('[data-choice-id=nickname-3]')"),
    'historique MSN après fermeture réelle',
  );
  assert.deepEqual((await saved()).dialogues, restored.dialogues);
  await command('Emulation.setDeviceMetricsOverride', {
    width: 800,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await wait(250);
  const accessible = await evaluate(
    "[...document.querySelectorAll('.dialogue-choice')].every(button=>{const r=button.getBoundingClientRect();return r.bottom<=innerHeight&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')===button;})",
  );
  assert.ok(accessible);
  await capture('pixelgirl-small.png');
  await command('Emulation.clearDeviceMetricsOverride');
  await evaluate("document.querySelector('[data-choice-id=nickname-3]').click()");
  await until(
    () => evaluate("!!document.querySelector('[data-choice-id=table-2]')"),
    'table choices',
    25000,
  );
  assert.ok(
    (await evaluate("document.querySelector('.conversation-log').textContent")).includes(
      '(╯°□°)╯︵ ┻━┻',
    ),
  );
  await evaluate("document.querySelector('[data-choice-id=table-2]').click()");
  await until(
    () => evaluate("!!document.querySelector('[data-choice-id=game-3]')"),
    'game invitation',
    15000,
  );
  await capture('pixelgirl-conversation.png');
  await evaluate("document.querySelector('[data-choice-id=game-3]').click()");
  await until(
    () => evaluate("!!document.querySelector('.transfer-refuse:not([hidden])')"),
    'file offer',
    20000,
  );
  await evaluate("document.querySelector('.transfer-refuse:not([hidden])').click()");
  await until(
    () => evaluate("document.querySelectorAll('.msn-transfer').length>=2"),
    'retry transfer',
    15000,
  );
  assert.equal(await evaluate("document.querySelectorAll('.desktop-file').length"), 0);
  await evaluate("document.querySelector('.transfer-accept:not([hidden])').click()");
  await until(
    () => evaluate("!!document.querySelector('[data-file-id=super-mega-game]')"),
    'desktop file',
    5000,
  );
  await until(
    () =>
      evaluate(
        "document.querySelector('.dialogue-choices button')?.textContent==='Retour au bureau'&&!document.querySelector('.dialogue-choices button').disabled",
      ),
    'good luck',
    8000,
  );
  const data = await saved();
  assert.equal(data.choices.length, 4);
  assert.ok(data.choices.every((choice) => choice.unselected.length === 2));
  await evaluate("document.querySelector('.dialogue-choices button').click()");
  assert.equal((await saved()).current, 'super-mega-game');
  await evaluate(
    "document.querySelector('[data-file-id=super-mega-game]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))",
  );
  await until(() => evaluate("!!document.querySelector('.popup-minigame')"), 'mini-game');
  await evaluate("document.querySelector('.flash-pause').click()");
  const remaining = await evaluate("document.querySelector('.flash-time').textContent");
  await wait(1000);
  assert.equal(await evaluate("document.querySelector('.flash-time').textContent"), remaining);
  await evaluate("document.querySelector('.flash-pause').click()");
  const end = Date.now() + 40000;
  while (Date.now() < end) {
    if (await evaluate("!document.querySelector('.flash-result').hidden")) break;
    await evaluate("document.querySelector('.catch-smiley')?.click()");
    await wait(300);
  }
  assert.ok(await evaluate("!document.querySelector('.flash-result').hidden"));
  assert.ok((await saved()).results['super-mega-game'].score > 0);
  await capture('smiley-catcher.png');
  await evaluate("document.querySelector('.flash-return').click()");
  assert.equal(await evaluate("!!document.querySelector('.popup-minigame')"), false);
  assert.equal((await saved()).current, null);
  const completedRun = await saved();
  await evaluate("document.querySelector('#return-main-menu').click(); window.__storyReload=true");
  await command('Page.reload');
  await until(
    () =>
      evaluate("window.__storyReload!==true&&window.chaosDebug?.snapshot().phase==='menu'").catch(
        () => false,
      ),
    'menu après histoire terminée',
  );
  await evaluate("document.querySelector('#menu-play').click()");
  await until(
    () => evaluate("window.chaosDebug.snapshot().phase==='desktop'"),
    'bureau après histoire terminée',
  );
  assert.equal((await saved()).current, null);
  assert.deepEqual((await saved()).completed, completedRun.completed);
  assert.equal(await evaluate("document.querySelector('#toast').hidden"), true);
  assert.equal(await evaluate("!!document.querySelector('.popup-minigame')"), false);
  await evaluate(
    "document.querySelector('#windows-start').click();document.querySelector('#menu-messenger').click()",
  );
  assert.equal(
    await evaluate("document.querySelectorAll('.conversation-message').length"),
    completedRun.dialogues['pixelgirl-intro'].transcript.length,
  );
  assert.equal(await evaluate("!!document.querySelector('.dialogue-choice')"), false);
  await evaluate("document.querySelector('.popup-narrative .close-button').click()");
  const beforeReplay = await saved();
  await evaluate(
    "document.querySelector('[data-shortcut=music]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))",
  );
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='playing'"), 'double clic MP3');
  assert.equal(Number(await evaluate("document.querySelector('#score').textContent")), 0);
  assert.equal((await evaluate('window.chaosDebug.snapshot()')).open, 0);
  assert.equal((await saved()).level1Launches, beforeReplay.level1Launches + 1);
  await until(
    () => evaluate("!document.querySelector('#toast-open').hidden"),
    'reaction de replay',
    8000,
  );
  assert.equal((await evaluate('window.chaosDebug.snapshot()')).phase, 'playing');
  assert.equal(await evaluate("!!document.querySelector('.popup-narrative')"), false);
  await evaluate("document.querySelector('#toast-open').click()");
  await until(
    () =>
      evaluate(
        "document.querySelector('.conversation-log')?.textContent.includes('champion du monde')",
      ),
    'messages de replay',
  );
  assert.ok(
    (await evaluate("document.querySelector('.conversation-log').textContent")).includes(
      'champion du monde',
    ),
  );
  assert.equal((await evaluate('window.chaosDebug.snapshot()')).phase, 'paused');
  assert.equal(await evaluate("document.querySelectorAll('.dialogue-choice').length"), 0);
  const pendingReply = await saved();
  await evaluate(
    "document.querySelector('.popup-narrative .close-button').click();document.querySelector('[data-shortcut=music]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))",
  );
  await until(
    () => evaluate("window.chaosDebug.snapshot().phase==='playing'"),
    'replay sans reponse',
  );
  await wait(2300);
  assert.equal((await saved()).level1Launches, beforeReplay.level1Launches + 2);
  assert.deepEqual(
    (await saved()).conversations.pixelgirl.history.slice(
      0,
      pendingReply.conversations.pixelgirl.history.length,
    ),
    pendingReply.conversations.pixelgirl.history,
  );
  assert.ok((await saved()).conversations.pixelgirl.history.at(-1).text.includes('ENCORE ???'));
  await evaluate(
    "document.querySelector('#windows-start').click();document.querySelector('#menu-messenger').click()",
  );
  await until(
    () =>
      evaluate("document.querySelector('.conversation-log')?.textContent.includes('ENCORE ???')"),
    'messages du replay suivant',
  );
  assert.equal(await evaluate("document.querySelectorAll('.dialogue-choice').length"), 0);
  assert.equal(
    await evaluate("document.querySelectorAll('.conversation-log button.dialogue-choice').length"),
    0,
  );
  assert.equal(
    await evaluate("document.querySelectorAll('.conversation-message').length"),
    (await saved()).conversations.pixelgirl.history.length,
  );
  assert.equal((await saved()).current, null);
  await evaluate(
    "document.querySelector('.popup-narrative .close-button').click();document.querySelector('#dialog-action').click()",
  );
  await until(
    () => evaluate("window.chaosDebug.snapshot().phase==='playing'"),
    'reprise apres MSN',
  );
  const replayDeadline = Date.now() + 105000;
  while (Date.now() < replayDeadline) {
    const snapshot = await evaluate('window.chaosDebug.snapshot()');
    if (snapshot.phase === 'ended') break;
    await evaluate("document.querySelector('.popup:not(.preview-window) .close-button')?.click()");
    await wait(250);
  }
  await until(
    () => evaluate("!!document.querySelector('#victory-continue')"),
    'victoire en rejouant',
  );
  await evaluate("document.querySelector('#victory-continue').click()");
  await until(
    () => evaluate("window.chaosDebug.snapshot().phase==='desktop'"),
    'bureau après replay',
  );
  assert.equal(await evaluate("document.querySelector('#toast').hidden"), true);
  const afterReplay = await saved();
  assert.deepEqual(afterReplay.completed, beforeReplay.completed);
  assert.deepEqual(afterReplay.files, beforeReplay.files);
  assert.deepEqual(
    afterReplay.dialogues['pixelgirl-intro'],
    beforeReplay.dialogues['pixelgirl-intro'],
  );
  assert.deepEqual(afterReplay.choices.slice(0, 4), beforeReplay.choices);
  await evaluate(
    "document.querySelector('[data-shortcut=music]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))",
  );
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='playing'"), 'second replay');
  assert.ok((await evaluate('window.chaosDebug.snapshot()')).audioTime < 1);
  await evaluate(
    "document.querySelector('#windows-start').click();document.querySelector('#menu-messenger').click()",
  );
  await until(
    () => evaluate("!!document.querySelector('.popup-narrative')"),
    'Messenger pendant le replay',
  );
  const messengerId = await evaluate("document.querySelector('.popup-narrative').dataset.windowId");
  await evaluate(
    "document.querySelector('.msn-minimize').click();document.querySelector('#dialog-action').click()",
  );
  await until(
    () =>
      evaluate(
        "document.querySelector('.conversation-log').textContent.includes('tu dors des fois')",
      ),
    'reaction Messenger reduit',
    8000,
  );
  assert.ok(await evaluate("document.querySelector('.popup-narrative').hidden"));
  assert.equal(
    await evaluate("document.querySelector('.popup-narrative').dataset.windowId"),
    messengerId,
  );
  assert.equal(await evaluate("document.querySelectorAll('.popup-narrative').length"), 1);
  assert.equal((await evaluate('window.chaosDebug.snapshot()')).phase, 'playing');
  assert.equal(await evaluate("document.querySelector('#msn-task').hidden"), false);
  await evaluate("document.querySelector('#msn-task').click()");
  assert.ok(
    (await evaluate("document.querySelector('.conversation-log').textContent")).includes(
      'médaille',
    ),
  );
  await wait(200);
  const beforeAbandon = await saved();
  await evaluate("document.querySelector('#return-main-menu').click()");
  await evaluate('window.__storyReload=true');
  await command('Page.reload');
  await until(
    () =>
      evaluate("window.__storyReload!==true&&window.chaosDebug?.snapshot().phase==='menu'").catch(
        () => false,
      ),
    'replay abandonne conserve',
  );
  assert.equal((await saved()).level1Launches, beforeAbandon.level1Launches);
  assert.deepEqual((await saved()).replayReactions, beforeAbandon.replayReactions);
  assert.deepEqual(
    (await saved()).conversations.pixelgirl.history,
    beforeAbandon.conversations.pixelgirl.history,
  );
  const archivedRun = await saved();
  await evaluate(
    "document.querySelector('#return-main-menu').click();document.querySelector('#menu-new-game').click();document.querySelector('#menu-confirm-yes').click()",
  );
  await until(
    () => evaluate("window.chaosDebug.snapshot().phase==='playing'"),
    'nouvelle partie après histoire terminée',
  );
  const archive = await evaluate(
    "JSON.parse(localStorage.getItem('chaos-survival-history-v1')).runs.at(-1)",
  );
  assert.equal(archive.runId, completedRun.runId);
  assert.deepEqual(archive.choices, archivedRun.choices);
  assert.deepEqual(archive.dialogues, archivedRun.dialogues);
  assert.deepEqual(archive.files, completedRun.files);
  assert.deepEqual((await saved()).choices, []);
  assert.equal((await saved()).level1Launches, 1);
  assert.deepEqual((await saved()).replayReactions, []);
  assert.deepEqual((await saved()).conversations.pixelgirl.history, []);
  console.log(
    'OK : quatre choix, branches communes, refus puis transfert, fichier fictif, Smiley Catcher 30 s et retour au bureau.',
  );
  return {
    victory,
    choices: 4,
    unselectedSaved: true,
    echo500ms: true,
    automaticMessages: true,
    persistedAcrossReload: true,
    transferRefusal: true,
    desktopFile: true,
    minigame: true,
    returnToDesktop: true,
    completedStoryResume: true,
    replayLevelWithoutNarrativeReset: true,
    messengerCloseRestore: true,
    newGamePreservesFullHistory: true,
    replayReactions: true,
    replayCountPersists: true,
    minimizedMessengerKeepsMessages: true,
    singlePersistentConversation: true,
    queuedNarrativeEvents: true,
  };
}
