import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithTheme } from '../test/utils';
import { ThemeToggle } from './ThemeToggle';

// With colorSchemeSelector 'data', MUI marks <html> with data-dark or data-light.
const scheme = () => {
  const html = document.documentElement;

  return html.hasAttribute('data-light') ? 'light' : html.hasAttribute('data-dark') ? 'dark' : null;
};

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-dark');
  document.documentElement.removeAttribute('data-light');
});

describe('ThemeToggle', () => {
  it('starts dark and offers the light theme', () => {
    renderWithTheme(<ThemeToggle />);

    expect(scheme()).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeTruthy();
  });

  it('switches to light, remembers it and switches back', () => {
    renderWithTheme(<ThemeToggle />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(scheme()).toBe('light');
    expect(localStorage.getItem('mui-mode')).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(scheme()).toBe('dark');
  });

  it('starts light when light was chosen before', () => {
    localStorage.setItem('mui-mode', 'light');

    renderWithTheme(<ThemeToggle />);

    expect(scheme()).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeTruthy();
  });
});
