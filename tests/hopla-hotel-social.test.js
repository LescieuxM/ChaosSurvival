import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/browser/sites/hopla-hotel/data.json' with { type: 'json' };
import conversations from '../src/browser/sites/hopla-hotel/conversations.json' with { type: 'json' };
import contacts from '../src/config/contacts.json' with { type: 'json' };
import {
  RoomSimulation,
  ROOM_START_DELAYS,
  messageDuration,
  placeBubbles,
} from '../src/browser/sites/hopla-hotel/simulation.js';
import { RoomWalk, blockedCells, inside } from '../src/browser/sites/hopla-hotel/model.js';
import { depthOrder } from '../src/browser/sites/hopla-hotel/draw.js';
const rooms = [data.room, ...data.rooms];
test('NPC display names stay attached to their existing room identities', () => {
  const expected = new Map([
    ['hall', ['ReceptionHotel', 'DarkFlo', 'Cerise', 'PixelGirl']],
    ['cafe', ['CafeMax', 'TiteFolle', 'xMel0dy']],
    ['discotheque', ['DJ-K7', 'miss-l0ve', 'BGdu62', 'Turb0']],
    ['detente', ['PauseClope', 'Nuage17', 'BiscuitSec']],
    ['jeux', ['Fredoux2', 'SuperMarioFan', 'Panda666', 'Skull']],
  ]);
  assert.deepEqual(new Map(rooms.map((room) => [room.id, room.npcs.map((npc) => npc.name)])), expected);
  const ids = new Set(rooms.flatMap((room) => room.npcs.map((npc) => npc.id)));
  for (const conversation of conversations)
    assert.ok(conversation.participants.every((id) => ids.has(id)), conversation.id);
});
function random(seed = 42) {
  return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}
const cellKey = (cell) => cell.join(':');
test('room entry delays are distinct and the scheduled conversations continue in order', () => {
  for (const room of rooms)
    for (const value of [0, 0.999999]) {
      const simulation = new RoomSimulation(room, { random: () => value });
      const [minimum, maximum] = ROOM_START_DELAYS[room.id];
      assert.ok(simulation.nextConversation >= minimum && simulation.nextConversation <= maximum);
      assert.equal(simulation.messages.size, 0);
      simulation.update(simulation.nextConversation);
      assert.equal(simulation.activeConversations.length, 1);
      const conversation = simulation.activeConversations[0].definition;
      assert.equal([...simulation.messages.values()][0].text, conversation.messages[0].text);
      assert.equal(simulation.activeConversations[0].index, 1);
      simulation.update(simulation.activeConversations[0].due - simulation.now);
      assert.ok(
        [...simulation.messages.values()].some((message) => message.text === conversation.messages[1].text),
      );
    }
});

test('a walking participant can start and speak without abandoning its reserved route', () => {
  const simulation = new RoomSimulation(rooms[0], { random: random() });
  const conversation = simulation.conversations[0];
  const npc = simulation.npcs.find((npc) => npc.id === conversation.participants[0]);
  assert.ok(simulation.move(npc.walk, [7, 2]));
  assert.ok(npc.walk.moving);
  assert.ok(simulation.startConversation(conversation));
  for (let time = 0; time < conversation.messages[0].delay; time += 100) {
    simulation.update(100);
    assertClear(simulation);
  }
  assert.ok(npc.walk.moving);
  assert.ok([...simulation.messages.values()].some((message) => message.speaker === npc.id));
});

test('busy conversations retry within three seconds and release participants after completion', () => {
  const conversation = conversations[0];
  const simulation = new RoomSimulation(rooms[0], {
    random: () => 0,
    conversations: [conversation],
  });
  simulation.nextSpontaneous = Infinity;
  assert.ok(simulation.startConversation(conversation));
  simulation.nextConversation = 0;
  simulation.update(0);
  assert.ok(simulation.nextConversation - simulation.now >= 1500);
  assert.ok(simulation.nextConversation - simulation.now <= 3000);
  assert.equal(simulation.activeConversations.length, 1);
  let completed = false,
    restarted = false;
  for (let i = 0; i < 200; i++) {
    simulation.update(100);
    if (!simulation.activeConversations.length) completed = true;
    if (completed && simulation.activeConversations.length) {
      restarted = true;
      break;
    }
    assert.ok(simulation.activeConversations.length <= 1);
  }
  assert.ok(
    completed && restarted,
    'a short conversation list never becomes permanently excluded by recent history',
  );
});

function assertClear(simulation) {
  const reserved = new Map();
  for (const walk of simulation.actors) {
    for (const cell of new Map(
      simulation.reserved(walk).map((cell) => [cellKey(cell), cell]),
    ).values()) {
      assert.ok(inside(simulation.room, cell));
      assert.ok(!simulation.staticBlocked.has(cellKey(cell)), `furniture ${cell}`);
      assert.ok(!reserved.has(cellKey(cell)), `overlap ${cell}`);
      reserved.set(cellKey(cell), walk);
    }
  }
}

test('18 local visitors have unique identities, free spawns and six distinct valid conversations per room', () => {
  assert.deepEqual(
    rooms.map((room) => room.npcs.length),
    [4, 3, 4, 3, 4],
  );
  const npcs = rooms.flatMap((room) => room.npcs);
  assert.equal(new Set(npcs.map((npc) => npc.id)).size, 18);
  assert.equal(new Set(npcs.map((npc) => npc.name)).size, 18);
  const storyNames = new Set(
    JSON.stringify(contacts)
      .match(/"[^"\n]+"/g)
      ?.map((name) => name.slice(1, -1)),
  );
  for (const npc of npcs) {
    if (npc.name !== 'Turb0') assert.ok(!storyNames.has(npc.name));
  }
  assert.equal(new Set(conversations.map((entry) => entry.id)).size, 30);
  for (const room of rooms) {
    const simulation = new RoomSimulation(room, { random: random() });
    assertClear(simulation);
    assert.equal(simulation.conversations.length, 6);
    for (const conversation of simulation.conversations) {
      assert.ok(conversation.messages.length >= 3 && conversation.messages.length <= 8);
      for (const message of conversation.messages) {
        assert.ok(conversation.participants.includes(message.speaker));
        assert.ok(message.delay >= 0 && message.delay <= 10000);
        assert.ok(!/\bbots?\b|simul[ée]|chatgpt|tiktok/i.test(message.text));
      }
    }
  }
  assert.equal(npcs[0].name, 'ReceptionHotel');
  assert.equal(npcs[0].appearance, undefined);
  assert.equal(npcs[0].dialogue, 'Bienvenue sur Hopla Hotel ! Amuse-toi bien ;)');
});

test('NPCs and player share RoomWalk and reserve simultaneous paths without swaps or blocked destinations', () => {
  const simulation = new RoomSimulation(rooms[0], { random: random() });
  for (const walk of simulation.actors) assert.ok(walk instanceof RoomWalk);
  const a = simulation.npcs[1],
    b = simulation.npcs[2];
  assert.equal(simulation.move(a.walk, [3, 2]), true);
  assert.equal(simulation.move(b.walk, [3, 2]), false);
  assert.equal(simulation.move(b.walk, [4, 8]), true);
  assert.equal(simulation.movePlayer([8, 7]), true);
  for (let i = 0; i < 10; i++) {
    simulation.update(100);
    assertClear(simulation);
  }
  assert.deepEqual(a.walk.cell, [3, 2]);
  assert.deepEqual(b.walk.cell, [4, 8]);
  assert.deepEqual(simulation.player.cell, [8, 7]);
  assert.equal(simulation.movePlayer(a.walk.cell), false);
  assert.equal(simulation.move(a.walk, [-1, 0]), false);
  assert.equal(simulation.moveNpc(simulation.npcs[0]), false);
  assert.equal(simulation.movePlayer([2, 4]), false);
});

test('invalidated destinations are abandoned safely and unsuccessful clicks preserve a player route', () => {
  const simulation = new RoomSimulation(rooms[0], { random: random() });
  assert.ok(simulation.movePlayer([9, 7]));
  simulation.update(100);
  const path = structuredClone(simulation.player.path);
  assert.equal(simulation.movePlayer([2, 4]), false);
  assert.deepEqual(simulation.player.path, path);
  simulation.staticBlocked.add('8:7');
  simulation.update(100);
  assert.equal(simulation.player.moving, false);
  assert.deepEqual(simulation.player.position, simulation.player.cell);
});

test('seeded ten-minute room simulations avoid obstacles/overlaps, preserve data and vary activity with quiet periods', () => {
  const before = structuredClone(data);
  for (const room of rooms) {
    const simulation = new RoomSimulation(room, { random: random(19) });
    let moves = 0,
      messages = 0,
      quiet = 0;
    const seen = new Set();
    for (let i = 0; i < 6000; i++) {
      if (i % 150 === 0) simulation.movePlayer([8, 7]);
      if (simulation.update(100)) {
        assertClear(simulation);
        if (simulation.moving) moves++;
      }
      messages += simulation.messages.size;
      if (!simulation.messages.size && !simulation.moving) quiet++;
      simulation.recent.forEach((id) => seen.add(id));
    }
    assert.ok(moves > 0 && messages > 0 && quiet > 100);
    assert.ok(seen.size >= 4, `${room.id}: dialogue variety`);
    if (room.id === 'hall')
      assert.deepEqual(simulation.npcs[0].walk.position, room.npcs[0].position);
    simulation.dispose();
    assert.equal(simulation.messages.size, 0);
    assert.equal(simulation.moving, false);
    assert.equal(simulation.update(100000), false);
  }
  assert.deepEqual(data, before);
});

test('conversations preserve message order and response delays without replay bursts after a long update', () => {
  const simulation = new RoomSimulation(rooms[0], { random: random() });
  const conversation = simulation.conversations[0];
  assert.ok(simulation.startConversation(conversation));
  for (const message of conversation.messages) {
    simulation.update(message.delay - 1);
    assert.equal([...simulation.messages.values()].at(-1)?.text === message.text, false);
    simulation.update(1);
    assert.equal([...simulation.messages.values()].at(-1).text, message.text);
  }
  assert.equal(simulation.activeConversations.length, 0);
  const late = new RoomSimulation(rooms[0], { random: random() });
  late.startConversation(late.conversations[0]);
  late.update(12000);
  assert.equal(late.activeConversations[0].index, 1);
  assert.equal(late.messages.size, 1);
});

test('only valid room conversations start, two independent pairs may overlap, and busy participants are excluded', () => {
  const simulation = new RoomSimulation(rooms[2], { random: random() });
  const first = simulation.conversations[0],
    second = simulation.conversations[1];
  assert.ok(simulation.startConversation(first));
  assert.ok(simulation.startConversation(second));
  assert.equal(simulation.startConversation(simulation.conversations[2]), false);
  assert.equal(simulation.startConversation(conversations[0]), false);
  simulation.update(Math.max(first.messages[0].delay, second.messages[0].delay));
  assert.equal(simulation.messages.size, 2);
  const invalid = new RoomSimulation(rooms[0], {
    conversations: [
      { ...conversations[0], participants: ['missing', 'cerise'] },
      { ...conversations[0], messages: [{ speaker: 'missing', text: 'hello', delay: 1 }] },
    ],
  });
  assert.equal(invalid.conversations.length, 0);
});

test('scheduler avoids its three latest conversations rather than replaying a fixed cycle', () => {
  const simulation = new RoomSimulation(rooms[0], { random: random(32) });
  const starts = [];
  let previous = [];
  for (let i = 0; i < 3000; i++) {
    simulation.update(100);
    if (JSON.stringify(previous) !== JSON.stringify(simulation.recent)) {
      const id = simulation.recent.at(-1);
      assert.ok(!previous.includes(id));
      starts.push(id);
      previous = [...simulation.recent];
    }
  }
  assert.ok(starts.length >= 5);
  assert.ok(new Set(starts).size >= 4);
});

test('message history preserves repeated speakers, expires individually and supports future player speech', () => {
  const simulation = new RoomSimulation(rooms[0], { random: random(), conversations: [] });
  assert.equal(simulation.say('unknown', 'no'), false);
  simulation.say('receptionhotel', 'cc');
  simulation.update(1000);
  simulation.say('receptionhotel', 'Bienvenue');
  assert.equal(simulation.messages.size, 2);
  assert.deepEqual(
    [...simulation.messages.values()].map((m) => m.text),
    ['cc', 'Bienvenue'],
  );
  simulation.say('player', 'Salut');
  assert.equal(simulation.messages.size, 3);
  simulation.update(messageDuration('cc') - 1001);
  assert.equal(simulation.messages.size, 3);
  simulation.update(1);
  assert.equal(simulation.messages.size, 2);
  assert.equal([...simulation.messages.values()][0].text, 'Bienvenue');
  simulation.update(1000);
  assert.equal(simulation.messages.size, 0);
  for (let i = 0; i < 20; i++) simulation.say('player', String(i));
  assert.equal(simulation.messages.size, 4);
  assert.equal([...simulation.messages.values()][0].text, '16');
  assert.ok(messageDuration('x'.repeat(1000)) <= 10000);
  assert.ok(messageDuration('x'.repeat(200)) > messageDuration('cc'));
});

test('reception follow-up is queued after the exact initial greeting', () => {
  const unrelated = {
    id: 'hall-test',
    room: 'hall',
    participants: ['darkflo', 'cerise'],
    messages: [{ speaker: 'darkflo', text: 'autre message', delay: 1000 }],
  };
  const simulation = new RoomSimulation(rooms[0], { conversations: [unrelated] });
  const receptionist = rooms[0].npcs[0];
  assert.equal(simulation.startConversation(unrelated), true);
  assert.equal(receptionist.dialogue, 'Bienvenue sur Hopla Hotel ! Amuse-toi bien ;)');
  assert.equal(receptionist.followUp, "Ici, il n'y a pas de crédits à dépenser ;)");
  assert.equal(simulation.say(receptionist.id, receptionist.dialogue), true);
  assert.equal(simulation.sayAfter(receptionist.id, receptionist.followUp, 2200), true);
  simulation.update(2199);
  assert.deepEqual([...simulation.messages.values()].map((message) => message.text), [receptionist.dialogue]);
  simulation.update(1);
  assert.deepEqual(
    [...simulation.messages.values()].map((message) => message.text),
    [receptionist.dialogue, receptionist.followUp],
  );
  simulation.update(1);
  assert.deepEqual(
    [...simulation.messages.values()].map((message) => message.text),
    [receptionist.dialogue, receptionist.followUp, 'autre message'],
  );
});

test('bubble layout stays inside resized viewports, avoids overlap when space permits and points to avatars', () => {
  for (const [width, height] of [
    [400, 300],
    [800, 600],
    [160, 120],
  ]) {
    const placements = placeBubbles(
      [
        { id: 'a', x: 0, y: 40, width: 140, height: 40 },
        { id: 'b', x: width, y: height, width: 140, height: 40 },
      ],
      width,
      height,
    );
    for (const p of placements) {
      assert.ok(
        p.left >= 6 &&
          p.top >= 6 &&
          p.left + p.width <= width - 6 &&
          p.top + p.height <= height - 6,
      );
      assert.ok(p.pointer >= 8 && p.pointer <= p.width - 8);
    }
  }
  const [a, b] = placeBubbles(
    [
      { x: 200, y: 180, width: 120, height: 40 },
      { x: 210, y: 180, width: 120, height: 40 },
    ],
    400,
    300,
  );
  assert.equal(a.top, b.top);
  assert.ok(a.left + a.width < b.left);
  const [single] = placeBubbles([{ x: 200, y: 180, width: 120, height: 40 }], 400, 300);
  assert.ok(a.left < single.left, 'older message shifts horizontally');
  const speakers = placeBubbles(
    [
      { id: 'right', x: 300, y: 180, width: 120, height: 40 },
      { id: 'left', x: 100, y: 180, width: 120, height: 40 },
    ],
    400,
    300,
  );
  assert.equal(speakers[0].id, 'left');
  assert.equal(speakers[1].id, 'right');
});

test('horizontal history wraps without collisions and follows speaker coordinates after resize/motion', () => {
  const messages = Array.from({ length: 4 }, (_, id) => ({
    id,
    x: 200,
    y: 230,
    width: 120,
    height: 40,
  }));
  for (const [width, height] of [
    [400, 300],
    [180, 260],
    [800, 600],
  ]) {
    const placed = placeBubbles(
      messages.map((m) => ({ ...m, x: width / 2, y: height - 20 })),
      width,
      height,
    );
    for (const p of placed) {
      assert.ok(p.left >= 6 && p.left + p.width <= width - 6);
      assert.ok(p.top >= 6 && p.top + p.height <= height - 6);
      for (const other of placed.filter((q) => q.id !== p.id)) {
        assert.ok(
          p.left + p.width <= other.left ||
            other.left + other.width <= p.left ||
            p.top + p.height <= other.top ||
            other.top + other.height <= p.top,
        );
      }
    }
    assert.ok(placed[0].left < placed[1].left || placed[0].top !== placed[1].top);
  }
  const [before] = placeBubbles(messages.slice(0, 1), 800, 600);
  const [after] = placeBubbles([{ ...messages[0], x: 250, y: 280 }], 800, 600);
  assert.equal(after.left - before.left, 50);
  assert.equal(after.top - before.top, 50);
});

test('depth order follows moving NPC positions and default reception graphics stay on the shared renderer', () => {
  const simulation = new RoomSimulation(rooms[0], { random: random() });
  const npc = simulation.npcs[1];
  simulation.move(npc.walk, [2, 3]);
  simulation.update(100);
  assert.equal(
    depthOrder(simulation.view, simulation.player).find((entry) => entry.item?.id === npc.id).depth,
    npc.position[0] + npc.position[1],
  );
  assert.ok(npc.walk.position[1] > 2 && npc.walk.position[1] < 3);
});
