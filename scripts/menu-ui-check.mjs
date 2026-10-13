import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function verifyMenuUI({ evaluate, command, until, wait, restart, outputDirectory }) {
  const click = async (selector) => {
    if (selector === '#return-main-menu') {
      await evaluate("document.querySelector('#windows-start').click()");
      assert.ok(
        await evaluate(
          "!document.querySelector('#start-menu').hidden && document.querySelector('#start-menu').contains(document.querySelector('#return-main-menu'))",
        ),
      );
      assert.ok(
        await evaluate(
          "(()=>{const e=document.querySelector('#return-main-menu'),r=e.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')===e;})()",
        ),
      );
    }
    return evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  };
  const saved = () => evaluate("JSON.parse(localStorage.getItem('chaos-survival-story-v1'))");
  const ready = () =>
    until(
      () =>
        evaluate(
          "window.chaosDebug?.snapshot().phase === 'menu' && !document.querySelector('#main-menu').hidden",
        ).catch(() => false),
      'menu principal',
    );
  const capture = async (name) => {
    const shot = await command('Page.captureScreenshot');
    await writeFile(path.join(outputDirectory, name), Buffer.from(shot.data, 'base64'));
  };
  await ready();
  assert.equal(await saved(), null);
  assert.equal(await evaluate("document.querySelector('#menu-play').textContent"), '★ PLAY ! ★');
  assert.equal(await evaluate("document.querySelector('#menu-new-game').hidden"), true);
  await capture('main-menu-first.png');
  await command('Emulation.setDeviceMetricsOverride', {
    width: 800,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await wait(200);
  assert.ok(
    await evaluate(
      "['#menu-play','#menu-options'].every(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')===e;})",
    ),
  );
  await capture('main-menu-small.png');
  await command('Emulation.clearDeviceMetricsOverride');
  await click('#menu-options');
  await evaluate(
    "for(const [id,value] of [['option-music',23],['option-effects',81]]){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}",
  );
  await click('#option-fullscreen');
  await until(() => evaluate('window.chaosWindow.getFullscreen()'), 'plein écran');
  await click('#options-back');
  await click('#menu-play');
  await until(
    () => evaluate("window.chaosDebug.snapshot().phase==='playing'"),
    'PLAY vers niveau rythmique',
  );
  const first = await saved();
  assert.equal(first.started, true);
  assert.equal(first.current, 'arcade-1');
  await restart();
  await ready();
  assert.equal((await saved()).runId, first.runId);
  assert.equal(await evaluate("document.querySelector('#menu-play').textContent"), '▶ CONTINUE !');
  assert.equal(await evaluate("document.querySelector('#menu-new-game').hidden"), false);
  assert.equal(await evaluate('window.chaosWindow.getFullscreen()'), true);
  await capture('main-menu-continue.png');
  await click('#menu-options');
  assert.equal(await evaluate("document.querySelector('#option-music').value"), '23');
  assert.equal(await evaluate("document.querySelector('#option-effects').value"), '81');
  await click('#option-fullscreen');
  await until(
    () => evaluate('window.chaosWindow.getFullscreen().then(v=>!v)'),
    'sortie plein écran',
  );
  await click('#options-back');
  await click('#menu-play');
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='playing'"), 'CONTINUE');
  await click('#pause-button');
  await until(
    () =>
      evaluate(
        "window.chaosDebug.snapshot().phase==='paused' && !document.querySelector('#modal-layer').hidden",
      ),
    'Démarrer pendant la pause',
  );
  await click('#return-main-menu');
  await ready();
  await click('#menu-new-game');
  assert.equal((await saved()).runId, first.runId);
  await click('#menu-confirm-no');
  assert.equal((await saved()).runId, first.runId);
  await click('#menu-new-game');
  await click('#menu-confirm-yes');
  await until(
    () => evaluate("window.chaosDebug.snapshot().phase==='playing'"),
    'nouvelle partie confirmée',
  );
  assert.notEqual((await saved()).runId, first.runId);
  const historical = await evaluate(
    "JSON.parse(localStorage.getItem('chaos-survival-history-v1'))",
  );
  assert.equal(historical.runs[0].runId, first.runId);
  assert.equal(
    await evaluate("JSON.parse(localStorage.getItem('chaos-survival-settings-v1')).musicVolume"),
    0.23,
  );
  await click('#return-main-menu');
  // Corruption only affects this disposable test profile.
  await evaluate(
    "localStorage.setItem('chaos-survival-story-v1','{invalid'); window.__menuReload=true",
  );
  await command('Page.reload');
  await until(
    () =>
      evaluate("window.__menuReload!==true && window.chaosDebug?.snapshot().phase==='menu'").catch(
        () => false,
      ),
    'sauvegarde corrompue',
  );
  assert.equal(await evaluate("document.querySelector('#menu-play').textContent"), '★ PLAY ! ★');
  assert.ok(
    await evaluate("document.querySelector('.menu-status').textContent.includes('illisible')"),
  );
  await click('#menu-options');
  await click('#menu-delete-data');
  await evaluate('window.__menuReload=true');
  await click('#menu-confirm-yes');
  await until(
    () =>
      evaluate("window.__menuReload!==true && window.chaosDebug?.snapshot().phase==='menu'").catch(
        () => false,
      ),
    'suppression des données',
  );
  assert.equal(await saved(), null);
  assert.equal(await evaluate("localStorage.getItem('chaos-survival-history-v1')"), null);
  assert.equal(await evaluate("document.querySelector('#option-music').value"), '55');
  console.log(
    'OK : premier lancement, PLAY, fermeture et relancement réels, CONTINUE, NEW GAME avec confirmation, historique, préférences et plein écran, corruption et effacement.',
  );
  return {
    firstLaunch: true,
    firstGame: true,
    realRelaunch: true,
    continue: true,
    newGameConfirmation: true,
    history: true,
    audioPreferences: true,
    fullscreen: true,
    corruptedSave: true,
    deleteData: true,
    smallWindow: true,
  };
}
