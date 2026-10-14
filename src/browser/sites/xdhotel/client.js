import data from './data.json' with { type: 'json' };
import { HOTEL_URL } from './model.js';
import { renderHotelRoom } from './render.js';

// A simulated desktop application; rooms and movement stay in the existing renderer.
export class HotelClient {
  constructor(manager, applications, onHome) {
    Object.assign(this, { manager, applications, onHome });
  }
  open() {
    if (this.instance?.element.isConnected) {
      this.applications.restore(this.instance);
      return this.instance;
    }
    const id = this.manager.spawn('desktopapp', {
      preview: true,
      content: { title: data.name, iconName: 'browser', body: '' },
      onDismiss: () => {
        const instance = this.instance;
        instance.cleanup?.();
        instance.observer.disconnect();
        instance.element.removeEventListener('click', instance.home);
        instance.task.remove();
        this.applications.instances.delete('hopla-hotel');
        this.instance = null;
        this.applications.onWindowState();
      },
    });
    const instance = this.applications.attachWindow('hopla-hotel', id, data.name, 'browser');
    this.instance = instance;
    const { element } = instance;
    element.classList.add('hopla-hotel-client');
    instance.onMinimize = () => instance.cleanup?.('pause');
    instance.onRestore = () => instance.resume?.();
    instance.home = (event) => {
      const link = event.target.closest('[data-browser-link]');
      if (!link) return;
      event.preventDefault();
      if (link.dataset.browserLink === HOTEL_URL) this.onHome?.();
    };
    element.addEventListener('click', instance.home);
    // movementBounds already accounts for the real desktop and taskbar, even in arcade mode.
    const area = () => this.manager.movementBounds({ offsetWidth: 0, offsetHeight: 0 });
    const bounds = area();
    const width = (bounds.maxX - bounds.minX) * 0.94;
    const height = (bounds.maxY - bounds.minY) * 0.94;
    Object.assign(element.style, {
      width: `${width}px`,
      height: `${height}px`,
      left: `${bounds.minX + (bounds.maxX - bounds.minX - width) / 2}px`,
      top: `${bounds.minY + (bounds.maxY - bounds.minY - height) / 2}px`,
    });
    this.manager.dragged.add(element);
    instance.observer = new ResizeObserver(() => {
      if (!element.isConnected || element.hidden) return;
      const current = area();
      const maxWidth = current.maxX - current.minX;
      const maxHeight = current.maxY - current.minY;
      element.style.maxWidth = `${maxWidth}px`;
      element.style.maxHeight = `${maxHeight}px`;
      element.style.minWidth = `${Math.min(320, maxWidth)}px`;
      element.style.minHeight = `${Math.min(220, maxHeight)}px`;
      element.style.width = `${Math.min(parseFloat(element.style.width), maxWidth)}px`;
      element.style.height = `${Math.min(parseFloat(element.style.height), maxHeight)}px`;
      const limits = this.manager.movementBounds(element);
      element.style.left = `${Math.max(limits.minX, Math.min(limits.maxX, parseFloat(element.style.left)))}px`;
      element.style.top = `${Math.max(limits.minY, Math.min(limits.maxY, parseFloat(element.style.top)))}px`;
    });
    instance.observer.observe(element);
    instance.observer.observe(this.manager.field.closest('.desktop') ?? this.manager.field);
    this.showRoom(data.room);
    this.applications.restore(instance);
    return instance;
  }
  showRoom(room) {
    const instance = this.instance;
    instance.cleanup?.();
    instance.cleanup = instance.resume = null;
    const context = {
      onDispose: (cleanup) => {
        instance.cleanup = cleanup;
      },
      onResume: (resume) => {
        instance.resume = resume;
      },
      navigate: (url) => {
        const destination = [data.room, ...data.rooms].find(
          (item) => url === `${HOTEL_URL}salle/${item.id}`,
        );
        if (destination) this.showRoom(destination);
      },
    };
    instance.element
      .querySelector('.window-body')
      .replaceChildren(renderHotelRoom(context, data, room));
  }
}
