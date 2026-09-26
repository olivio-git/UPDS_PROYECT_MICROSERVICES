import { sessionSchema } from '../src/schemas/session.schema';

/**
 * Browser lockdown (fullscreen + tab-switch infractions) is on for every new
 * session unless the teacher turns it off. Editing a session must not flip
 * the value it already has.
 */
const createSettings = sessionSchema.create.shape.settings.unwrap();
const updateSettings = sessionSchema.update.shape.settings.unwrap();

describe('session browserLockdown default', () => {
  it('is on for a new session that does not say otherwise', () => {
    expect(createSettings.parse({}).browserLockdown).toBe(true);
  });

  it('stays off when the teacher turns it off', () => {
    expect(createSettings.parse({ browserLockdown: false }).browserLockdown).toBe(false);
  });

  it('is left untouched by an update that does not mention it', () => {
    expect(updateSettings.parse({}).browserLockdown).toBeUndefined();
  });
});
