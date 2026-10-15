// The helpline button, and links that fall back to words when the device can't open them.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Alert, Linking } from 'react-native';

import { APP_LINKS, callSupportLine, emailSupport, openOr, openPage, SUPPORT_LINE } from '../support';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('openOr', () => {
  it('runs the fallback only when the link fails to open', async () => {
    const fallback = jest.fn();
    jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('no handler'));
    openOr('https://example.com', fallback);
    await flush();
    expect(fallback).not.toHaveBeenCalled();
    openOr('mailto:x@example.com', fallback);
    await flush();
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});

describe('callSupportLine', () => {
  it('calls the helpline', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    callSupportLine();
    await flush();
    expect(open).toHaveBeenCalledWith(SUPPORT_LINE.tel);
    expect(alert).not.toHaveBeenCalled();
  });

  it("gives the number and the text option where calls aren't possible", async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('Unable to open URL: tel:18006624357'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    callSupportLine();
    await flush();
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, message] = alert.mock.calls[0]!;
    expect(title).toBe("Calls aren't available on this device");
    expect(message).toContain('1-800-662-4357');
    expect(message).toContain('435748');
  });
});

describe('About links', () => {
  it('opens a page, or says where it is', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no browser'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    openPage('https://example.com/privacy');
    await flush();
    expect(open).toHaveBeenCalledWith('https://example.com/privacy');
    expect(alert).toHaveBeenCalledWith("Couldn't open the page", "It's at https://example.com/privacy.");
  });

  it('starts an email with the subject, or gives the address when there is no mail app', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no mail app'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    emailSupport('Win Zero 1.0.0');
    await flush();
    expect(open).toHaveBeenCalledWith(`mailto:${APP_LINKS.email}?subject=Win%20Zero%201.0.0`);
    expect(alert).toHaveBeenCalledWith('No mail app is set up', `Email us at ${APP_LINKS.email}.`);
  });
});
