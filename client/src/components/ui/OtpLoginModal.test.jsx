import OtpLoginModal from './OtpLoginModal';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/userEvent';
import { vi } from 'vitest';

describe('OtpLoginModal', () => {
  it('renders without crashing', () => {
    render(<OtpLoginModal isOpen={true} onClose={vi.fn()} onLogin={vi.fn()} />);
    expect(screen.getByText('Login with Phone')).toBeInTheDocument();
  });
});