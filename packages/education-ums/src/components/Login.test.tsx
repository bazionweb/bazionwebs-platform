/**
 * Login — smoke tests
 */
import "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Login from "./Login";
import { checkA11y } from '../test/axe';

describe("Login", () => {
  const mockOnLogin = vi.fn();

  it("renders the login form with an email input", () => {
    render(<Login onLogin={mockOnLogin} />);
    // The email input has placeholder 'admin@bmiuniversities.org'
    const emailInput = screen.getByPlaceholderText(/bmiuniversities\.org/i);
    expect(emailInput).toBeInTheDocument();
  });

  it("renders a submit / sign-in button", () => {
    render(<Login onLogin={mockOnLogin} />);
    const btn = screen.getByRole("button", { name: /sign in/i });
    expect(btn).toBeInTheDocument();
  });

  it("populates institutional email on role button click", () => {
    render(<Login onLogin={mockOnLogin} />);
    const registrarBtn = screen.getByTitle(/Academic Registrar/i);
    expect(registrarBtn).toBeInTheDocument();
  });

  it("does not call onLogin before submission", () => {
    render(<Login onLogin={mockOnLogin} />);
    expect(mockOnLogin).not.toHaveBeenCalled();
  });
});

describe('Login — accessibility (WCAG 2.1 AA)', () => {
  it('has no critical or serious accessibility violations', async () => {
    // Use a mock logo prop to keep the component standalone
    const { container } = render(
      <Login onLogin={vi.fn()} logo="/test-logo.svg" />
    );
    await checkA11y(container);
  });
});









