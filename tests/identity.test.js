import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applications, applicationLogo, brandedText, trackIdentity } from '../src/ui/identity.js';
import { icon } from '../src/ui/icons.js';
import { createPopupContent } from '../src/ui/popup-content.js';
import { popupContent } from '../src/config/popups.js';
import { arcadeLauncher, isArcadeExecutable } from '../src/ui/arcade-launcher.js';
import { mountDesktop } from '../src/ui/desktop.js';

test('the desktop exposes the game EXE and keeps MP3 metadata separate from its launcher', () => {
  const root = { querySelector: () => ({}), querySelectorAll: () => [] };
  mountDesktop(root, 0);
  assert.equal(arcadeLauncher.name, 'ChaosSurvival.exe');
  assert.match(root.innerHTML, /data-shortcut="arcade"/);
  assert.doesNotMatch(root.innerHTML, /data-shortcut="music"/);
  assert.ok(root.innerHTML.includes(arcadeLauncher.name));
  assert.ok(isArcadeExecutable({ name: arcadeLauncher.name }));
  for (const name of ['DJARTMUSIC__Best_Game_Console.mp3', 'another.exe', 'ChaosSurvival.exe.txt'])
    assert.equal(isArcadeExecutable({ name }), false);
  assert.equal(isArcadeExecutable({ name: arcadeLauncher.name, location: 'folder' }), false);
  assert.equal(trackIdentity.displayName, 'DJARTMUSIC__Best_Game_Console.mp3');
  const resource = icon(arcadeLauncher.icon).match(/src="([^"]+)"/)[1];
  const svg = readFileSync(new URL(`../public/${resource.slice(2)}`, import.meta.url), 'utf8');
  assert.match(svg, /viewBox="0 0 48 48"/);
  assert.doesNotMatch(svg, /<script|href=/);
});
test('all five brands have distinct local SVGs and the legacy icon IDs still work', () => {
  assert.equal(new Set(Object.values(applications).map((item) => item.logo)).size, 5);
  for (const key of Object.keys(applications)) {
    const svg = readFileSync(
      new URL(`../public/${applicationLogo(key).slice(2)}`, import.meta.url),
      'utf8',
    );
    assert.match(svg, /viewBox="0 0 48 48"/);
    assert.match(svg, /Gradient/);
    assert.doesNotMatch(svg, /<image|<script|href=/);
    assert.ok(icon(key).includes(applications[key].logo));
  }
  assert.ok(icon('flag').includes(applications.system.logo));
  assert.ok(icon('msn').includes(applications.messenger.logo));
  assert.ok(icon('globe').includes(applications.browser.logo));
  assert.ok(icon('music').includes(applications.media.logo));
});
test('visible arcade app names are harmonized without rewriting their configuration or narrative', () => {
  const old =
    /Windows Live Messenger|Internet Explorer|Windows Media Player|Windows Update|Windows XP/;
  for (const [type, variants] of Object.entries(popupContent))
    for (let index = 0; index < variants.length; index++) {
      const popup = createPopupContent(type, () => (index + 0.1) / variants.length);
      assert.doesNotMatch(`${popup.title} ${popup.body}`, old);
    }
  assert.equal(brandedText('Windows XP / Windows Update'), 'Windows XD / Windows Upgrade');
  assert.equal(trackIdentity.displayName, 'DJARTMUSIC__Best_Game_Console.mp3');
  assert.equal(trackIdentity.genre, '8-bit / chiptune');
  const cover = readFileSync(
    new URL(`../public/${trackIdentity.cover.slice(2)}`, import.meta.url),
    'utf8',
  );
  assert.match(cover, /shape-rendering="crispEdges"/);
  assert.doesNotMatch(cover, /<image|<script|href=/);
  assert.equal(trackIdentity.source, 'Pixabay');
});
