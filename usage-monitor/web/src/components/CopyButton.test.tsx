import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithTheme, stubClipboard } from '../test/utils';
import { CopyButton } from './CopyButton';

const ID = '4c1e9f2a-77b0-4f6e-a1d3-9d0b5e6a7c11';

// The write settles after the click, so the click is awaited inside act.
const click = (el: HTMLElement) =>
  act(async () => {
    fireEvent.click(el);
  });

const setup = () => {
  const view = renderWithTheme(<CopyButton value={ID} label="Copy session id" />);
  const button = screen.getByRole('button', { name: 'Copy session id' });
  const iconPath = () => button.querySelector('path')!.getAttribute('d');
  return { ...view, button, iconPath };
};

describe('CopyButton', () => {
  it('is a button named by its label that copies the whole value', async () => {
    const writeText = stubClipboard();
    const { button } = setup();

    await click(button);
    expect(writeText).toHaveBeenCalledExactlyOnceWith(ID);
  });

  it('turns into a check and says Copied for 1.5 s, then resets', async () => {
    vi.useFakeTimers();
    stubClipboard();
    const { button, iconPath } = setup();
    const copyIcon = iconPath();

    fireEvent.mouseOver(button);
    await click(button);
    act(() => vi.advanceTimersByTime(100)); // the tooltip's enter delay
    expect(iconPath()).not.toBe(copyIcon);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Copied');
    expect(button).toHaveAccessibleName('Copy session id'); // the name stays the label

    act(() => vi.advanceTimersByTime(1399));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Copied');

    act(() => vi.advanceTimersByTime(1));
    expect(iconPath()).toBe(copyIcon);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Copy session id');
  });

  it('starts the 1.5 s over when copied again', async () => {
    vi.useFakeTimers();
    stubClipboard();
    const { button, iconPath } = setup();
    const copyIcon = iconPath();

    await click(button);
    act(() => vi.advanceTimersByTime(1000));
    await click(button);
    act(() => vi.advanceTimersByTime(1000));
    expect(iconPath()).not.toBe(copyIcon);

    act(() => vi.advanceTimersByTime(500));
    expect(iconPath()).toBe(copyIcon);
  });

  it('clears its timer when unmounted', async () => {
    vi.useFakeTimers();
    stubClipboard();
    const { button, unmount } = setup();

    await click(button);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows no check and throws nothing when the write is refused', async () => {
    stubClipboard(() => Promise.reject(new Error('NotAllowedError')));
    const { button, iconPath } = setup();
    const copyIcon = iconPath();

    await click(button);
    expect(iconPath()).toBe(copyIcon);
  });

  it('shows no check and throws nothing when there is no clipboard', async () => {
    const { button, iconPath } = setup();
    const copyIcon = iconPath();

    await click(button);
    expect(iconPath()).toBe(copyIcon);
  });
});
