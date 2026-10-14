import config from '../config/buddy.json' with { type: 'json' };
import { icon } from './icons.js';

// Passive assistant: only explicit activation can unlock future story bubbles.
export class Buddy {
  constructor(root, progression, definition = config) {
    Object.assign(this, { progression, definition });
    this.element = document.createElement('aside');
    this.element.className = 'buddy';
    this.element.setAttribute('aria-label', 'Assistant Buddy');
    this.element.innerHTML = `<div class="buddy-bubble" hidden><button class="buddy-close" aria-label="Fermer la bulle de Buddy">×</button><p role="status" aria-live="polite"></p></div>
      <div class="buddy-figure">${icon('buddy', 'buddy-character')}<button class="buddy-hide" aria-label="Masquer Buddy">×</button></div>`;
    root.append(this.element);
    this.bubble = this.element.querySelector('.buddy-bubble');
    this.text = this.element.querySelector('p');
    this.element.querySelector('.buddy-close').addEventListener('click', () => this.closeBubble());
    this.element.querySelector('.buddy-hide').addEventListener('click', () => this.hide());
    this.restore();
  }
  restore() {
    const saved = this.progression.data.buddy;
    this.opened = saved?.opened === true;
    this.visible = this.opened && saved?.visible === true;
    this.sequence = [];
    this.hideAt = this.nextAt = null;
    this.tipIndex = 0;
    this.bubble.hidden = true;
    this.animate('idle');
    this.render();
  }
  persist() {
    this.progression.data.buddy = { opened: this.opened, visible: this.visible };
    this.progression.save();
  }
  setActive(active) {
    this.active = active;
    this.render();
  }
  render() {
    this.element.hidden = !this.active || (!this.visible && this.hideAt === null);
  }
  animate(name) {
    this.element.dataset.animation = name;
  }
  open(now = Date.now()) {
    const first = !this.opened;
    this.opened = this.visible = true;
    this.hideAt = null;
    this.persist();
    this.render();
    if (first) {
      this.sequence = [...this.definition.introduction];
      this.next(now);
    } else if (!this.sequence.length && this.nextAt === null) {
      this.say(this.definition.tips[this.tipIndex++ % this.definition.tips.length], { now });
    }
  }
  next(now) {
    const message = this.sequence.shift();
    if (message) this.say(message.text, { ...message, now });
    else this.closeBubble();
  }
  // Reusable hook for future events; never auto-activates an unopened/hidden assistant.
  say(text, { durationMs = 5000, animation = 'explaining', now = Date.now() } = {}) {
    if (!this.opened || !this.visible || typeof text !== 'string') return false;
    this.text.textContent = text;
    this.bubble.hidden = false;
    this.animate(animation);
    this.nextAt = now + durationMs;
    return true;
  }
  closeBubble() {
    this.sequence = [];
    this.nextAt = null;
    this.bubble.hidden = true;
    this.animate('idle');
  }
  hide(now = Date.now()) {
    if (!this.visible) return;
    this.closeBubble();
    this.visible = false;
    this.hideAt = now + 300;
    this.animate('leaving');
    this.persist();
    this.render();
  }
  update(now = Date.now()) {
    if (this.hideAt !== null && now >= this.hideAt) {
      this.hideAt = null;
      this.render();
    }
    if (this.nextAt !== null && now >= this.nextAt) this.next(now);
  }
}
