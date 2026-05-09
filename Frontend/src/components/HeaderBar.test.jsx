import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HeaderBar from './HeaderBar';

describe('HeaderBar', () => {
  it('renders login and signup links when the session has no token', () => {
    render(
      <MemoryRouter>
        <HeaderBar gateway="http://localhost" setGateway={() => {}} session={{ token: '' }} onLogout={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /signup/i })).toHaveAttribute('href', '/signup');
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
  });

  it('renders logout button when the session includes a token', () => {
    const onLogout = vi.fn();

    render(
      <MemoryRouter>
        <HeaderBar gateway="http://localhost" setGateway={() => {}} session={{ token: 'abc' }} onLogout={onLogout} />
      </MemoryRouter>
    );

    const logoutButton = screen.getByRole('button', { name: /logout/i });
    expect(logoutButton).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /login/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /signup/i })).not.toBeInTheDocument();

    fireEvent.click(logoutButton);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('falls back to login/signup links when session is empty or missing token', () => {
    render(
      <MemoryRouter>
        <HeaderBar gateway="http://localhost" setGateway={() => {}} session={{}} onLogout={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /signup/i })).toBeInTheDocument();
  });
});
