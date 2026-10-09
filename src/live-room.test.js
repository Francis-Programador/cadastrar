import { describe, expect, it } from 'vitest';
import { getConfiguredRoomState, getYouTubeEmbedUrl } from '../membros/assets/live-room.js';

describe('live room configuration', () => {
  it('does not claim a stream is live unless the live state and a valid video are configured', () => {
    expect(getConfiguredRoomState({ status: '', streamUrl: '', nextSessionAt: '' }).state)
      .toBe('unconfigured');
    expect(getConfiguredRoomState({ status: 'LIVE', streamUrl: '' }).state)
      .toBe('error');
    expect(getConfiguredRoomState({ status: 'OFFLINE', streamUrl: '' }).state)
      .toBe('offline');
    expect(getConfiguredRoomState({
      status: 'LIVE',
      streamUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    }).state).toBe('live');
  });

  it('accepts supported YouTube URLs and rejects unrelated or unsafe URLs', () => {
    expect(getYouTubeEmbedUrl('https://youtu.be/abcdefghijk'))
      .toBe('https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0&autoplay=0');
    expect(getYouTubeEmbedUrl('https://www.youtube.com/live/abcdefghijk'))
      .toContain('/embed/abcdefghijk');
    expect(getYouTubeEmbedUrl('http://www.youtube.com/watch?v=abcdefghijk')).toBe('');
    expect(getYouTubeEmbedUrl('https://example.com/watch?v=abcdefghijk')).toBe('');
    expect(getYouTubeEmbedUrl('https://www.youtube.com/watch?v=short')).toBe('');
  });

  it('keeps the configured channel link separate from the stream URL', async () => {
    const { liveRoomConfig } = await import('../membros/assets/live-room-config.js');
    expect(liveRoomConfig.channelUrl)
      .toBe('https://www.youtube.com/@3S.E.R_TRADER_SEM_RÉ');
    expect(getYouTubeEmbedUrl(liveRoomConfig.channelUrl)).toBe('');
  });
});
