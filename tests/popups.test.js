import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { popupContent, WINDOW_TYPES } from '../src/config/popups.js';
import { createPopupContent } from '../src/ui/popup-content.js';
import { compileChart, Timeline } from '../src/game/timeline.js';
import { GameState } from '../src/game/state.js';

test('every popup variant renders its content and offers a way to dismiss non-MSN windows', () => {
  for (const type of WINDOW_TYPES) {
    popupContent[type].forEach((_variant, index, variants) => {
      const content = createPopupContent(type, () => (index + 0.5) / variants.length);
      assert.ok(content.title.length > 0, type);
      assert.ok(content.iconName.length > 0, type);
      assert.ok(content.body.length > 0, type);
      assert.ok(!content.body.includes('undefined'), `${type}: ${index}`);
      if (type !== 'msn') assert.match(content.body, /data-dismiss/, type);
    });
  }
  assert.throws(() => createPopupContent('unknown'), /Type de fenêtre inconnu/);
  assert.throws(() => createPopupContent('constructor'), /Type de fenêtre inconnu/);
});

test('MSN messages display hearts and emoticons as text rather than HTML', () => {
  const conversation = createPopupContent('msn', () => 2.5 / popupContent.msn.length);
  assert.match(conversation.body, /&lt;3/);
  assert.equal((conversation.body.match(/dit :/g) ?? []).length, 3);
});

test('virus and download events fire once and closing them rewards points and relieves chaos', () => {
  const chart = JSON.parse(readFileSync(new URL('../src/config/chart.json', import.meta.url)));
  const music = JSON.parse(
    readFileSync(new URL('../src/config/music-lvl1.analysis.json', import.meta.url)),
  );
  const events = compileChart(chart, music);
  for (const type of WINDOW_TYPES)
    assert.ok(
      events.some((event) => event.type === type),
      type,
    );

  const newEvents = events.filter((event) => ['virus', 'download'].includes(event.type));
  const timeline = new Timeline(newEvents);
  const state = new GameState(chart.gameplay);
  const received = [];
  const close = (event) => {
    received.push(event);
    state.spawn();
    state.update(1);
    assert.ok(state.chaos > 0);
    assert.equal(state.close(), chart.gameplay.pointsPerClose);
    assert.equal(state.chaos, 0);
  };
  timeline.advance(chart.durationSeconds, close);
  timeline.advance(chart.durationSeconds, close);
  assert.deepEqual(received, newEvents);
  assert.equal(state.closed, newEvents.length);
  assert.equal(state.open, 0);
  assert.equal(state.score, newEvents.length * chart.gameplay.pointsPerClose);
});
