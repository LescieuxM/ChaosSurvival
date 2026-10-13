import identity from '../config/identity.json' with { type: 'json' };
export const applications = identity.applications;
export const trackIdentity = identity.music;
export function applicationName(key) {
  return applications[key].name;
}
export function brandedText(value) {
  return String(value).replace(
    /Windows Live Messenger|MSN Messenger|Internet Explorer|Windows Media Player|Windows Update|Windows XP|Bureau XP|Windows —/g,
    (name) =>
      ({
        'Windows Live Messenger': applicationName('messenger'),
        'MSN Messenger': applicationName('messenger'),
        'Internet Explorer': applicationName('browser'),
        'Windows Media Player': applicationName('media'),
        'Windows Update': applicationName('upgrade'),
        'Windows XP': applicationName('system'),
        'Bureau XP': `Bureau ${applicationName('system')}`,
        'Windows —': `${applicationName('system')} —`,
      })[name],
  );
}
export const brandIcons = {
  flag: 'system',
  system: 'system',
  msn: 'messenger',
  messenger: 'messenger',
  globe: 'browser',
  browser: 'browser',
  music: 'media',
  media: 'media',
  upgrade: 'upgrade',
};
export function applicationLogo(key) {
  const path = applications[key].logo;
  if (!/^\.\/logos\/[a-z0-9-]+\.svg$/.test(path)) throw new Error('Logo local invalide.');
  return path;
}
