import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from './Login';
import { useAuth } from '../auth/AuthContext';
import { NewPasswordRequiredError } from '../auth/CognitoService';

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));

const mockLogin = vi.fn();
const mockCompleteNewPassword = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    login: mockLogin,
    completeNewPassword: mockCompleteNewPassword,
    logout: vi.fn(),
    user: null,
    isAuthenticated: false,
    isLoading: false,
  });
});

describe('Login — sign in step', () => {
  it('validates that email and password are both required', () => {
    const { container } = render(<Login />);
    // fireEvent.submit bypasses jsdom's native `required`-attribute validation,
    // which would otherwise block the submit event before the app's own JS check runs.
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.getByText('Email and password are required.')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login with trimmed email and the password', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('admin@yourshop.com'), { target: { value: '  a@shop.com  ' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pw123456' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('a@shop.com', 'pw123456'));
  });

  it('shows the Cognito error message on failure', async () => {
    mockLogin.mockRejectedValue(new Error('Incorrect username or password.'));
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('admin@yourshop.com'), { target: { value: 'a@shop.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => expect(screen.getByText('Incorrect username or password.')).toBeInTheDocument());
  });

  it('falls back to a generic error message for a non-Error rejection', async () => {
    mockLogin.mockRejectedValue('some string rejection');
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('admin@yourshop.com'), { target: { value: 'a@shop.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument());
  });

  it('switches to the new-password step on NewPasswordRequiredError', async () => {
    mockLogin.mockRejectedValue(new NewPasswordRequiredError());
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText('admin@yourshop.com'), { target: { value: 'a@shop.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'temp-pw' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => expect(screen.getByText('Set New Password')).toBeInTheDocument());
  });

  it('toggles password visibility', () => {
    render(<Login />);
    const input = screen.getByPlaceholderText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByText('👁️'));
    expect(input.type).toBe('text');
  });
});

describe('Login — new password step', () => {
  async function goToNewPasswordStep() {
    mockLogin.mockRejectedValue(new NewPasswordRequiredError());
    const result = render(<Login />);
    fireEvent.change(screen.getByPlaceholderText('admin@yourshop.com'), { target: { value: 'a@shop.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'temp-pw' } });
    fireEvent.click(screen.getByText('Sign In'));
    await waitFor(() => screen.getByText('Set New Password'));
    return result;
  }

  it('requires both fields', async () => {
    const { container } = await goToNewPasswordStep();
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.getByText('Both fields are required.')).toBeInTheDocument();
  });

  it('requires the passwords to match', async () => {
    await goToNewPasswordStep();
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'password1' } });
    fireEvent.change(screen.getByPlaceholderText('Repeat new password'), { target: { value: 'password2' } });
    fireEvent.click(screen.getByText('Set Password & Sign In'));
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('requires at least 8 characters', async () => {
    await goToNewPasswordStep();
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'short' } });
    fireEvent.change(screen.getByPlaceholderText('Repeat new password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByText('Set Password & Sign In'));
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
  });

  it('calls completeNewPassword on valid matching input', async () => {
    mockCompleteNewPassword.mockResolvedValue(undefined);
    await goToNewPasswordStep();
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'password1' } });
    fireEvent.change(screen.getByPlaceholderText('Repeat new password'), { target: { value: 'password1' } });
    fireEvent.click(screen.getByText('Set Password & Sign In'));

    await waitFor(() => expect(mockCompleteNewPassword).toHaveBeenCalledWith('password1'));
  });

  it('shows an error message when completeNewPassword rejects', async () => {
    mockCompleteNewPassword.mockRejectedValue(new Error('policy violation'));
    await goToNewPasswordStep();
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'password1' } });
    fireEvent.change(screen.getByPlaceholderText('Repeat new password'), { target: { value: 'password1' } });
    fireEvent.click(screen.getByText('Set Password & Sign In'));

    await waitFor(() => expect(screen.getByText('policy violation')).toBeInTheDocument());
  });
});
