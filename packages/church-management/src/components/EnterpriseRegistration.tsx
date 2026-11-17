import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, UserPlusIcon, ArrowRightIcon } from './Icons';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { User as AppUser } from './userData';
import {
  PasswordCriteria,
  validateEmail,
  validatePassword,
  getPasswordStrength,
} from '../utils/registrationValidation';
import VerificationScreen from './registration/VerificationScreen';
import RegistrationStepPersonal from './registration/RegistrationStepPersonal';
import RegistrationStepSecurity from './registration/RegistrationStepSecurity';
import RegistrationStepTerms from './registration/RegistrationStepTerms';

export interface RegistrationData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export interface RegistrationResult {
  success: boolean;
  message?: string;
  requiresVerification?: boolean;
  user?: AppUser;
}

interface EnterpriseRegistrationProps {
  onRegister: (data: RegistrationData) => Promise<RegistrationResult>;
  onBack: () => void;
  onResendVerification?: (email: string) => Promise<boolean>;
}

export const EnterpriseRegistration: React.FC<EnterpriseRegistrationProps> = ({
  onRegister,
  onBack,
  onResendVerification,
}) => {
  // Form state
  const [formData, setFormData] = useState<RegistrationData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    avatar: '',
    acceptTerms: false,
    acceptPrivacy: false,
  });

  // UI state
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Validation state
  const [emailValid, setEmailValid] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordCriteria, setPasswordCriteria] = useState<PasswordCriteria>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    noCommonPatterns: false,
  });
  const [passwordsMatch, setPasswordsMatch] = useState(false);
  const emailExists = false;

  // Email verification state
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Handle input changes
  const handleInputChange = (field: keyof RegistrationData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  // Handle email validation
  useEffect(() => {
    if (formData.email) {
      setEmailValid(validateEmail(formData.email));
    }
  }, [formData.email, emailTouched]);

  // Handle password validation
  useEffect(() => {
    if (formData.password) {
      setPasswordCriteria(validatePassword(formData.password));
    }
  }, [formData.password]);

  // Handle password matching
  useEffect(() => {
    if (formData.confirmPassword) {
      setPasswordsMatch(formData.password === formData.confirmPassword);
    }
  }, [formData.password, formData.confirmPassword]);

  // Handle avatar upload
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (file.size > 5 * 1024 * 1024) {
        setError('Avatar image must be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        handleInputChange('avatar', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Validate current step
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return (
          emailValid && !emailExists && formData.firstName.trim().length >= 2 && formData.lastName.trim().length >= 2
        );
      case 2: {
        const passwordScore = getPasswordStrength(passwordCriteria);
        return passwordScore >= 75 && passwordsMatch;
      }
      case 3:
        return formData.acceptTerms && formData.acceptPrivacy;
      default:
        return false;
    }
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
      setError('');
    } else {
      if (currentStep === 1) {
        if (!formData.firstName.trim() || !formData.lastName.trim()) {
          setError('Please enter your first and last name');
        } else if (!emailValid) {
          setError('Please enter a valid email address');
        }
      } else if (currentStep === 2) {
        const passwordScore = getPasswordStrength(passwordCriteria);
        if (passwordScore < 75) {
          setError('Please create a stronger password that meets all criteria');
        } else if (!passwordsMatch) {
          setError('Passwords do not match');
        }
      }
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(3)) {
      setError('Please accept the Terms of Service and Privacy Policy to continue');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await onRegister(formData);
      if (result.success) {
        if (result.requiresVerification) {
          setVerificationEmail(formData.email);
          setVerificationSent(true);
          setSuccessMessage('Account created successfully! Please check your email to verify your account.');
        } else {
          setSuccessMessage('Account created successfully! You can now log in.');
        }
      } else {
        setError(result.message || 'Registration failed. Please try again.');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setError(msg || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!onResendVerification || resendCooldown > 0) return;

    setIsLoading(true);
    try {
      const success = await onResendVerification(verificationEmail);
      if (success) {
        setSuccessMessage('Verification email sent! Please check your inbox.');
        setResendCooldown(60);

        const timer = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setError('Failed to send verification email. Please try again.');
      }
    } catch {
      setError('Failed to send verification email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <VerificationScreen
        verificationEmail={verificationEmail}
        successMessage={successMessage}
        error={error}
        isLoading={isLoading}
        resendCooldown={resendCooldown}
        onResendVerification={handleResendVerification}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <img src="/hkm-logo.webp" alt="Heavenly God Kingdom Churches Logo" className="h-16 w-auto mx-auto" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Create Your Account</h1>
            <p className="text-gray-500">Join HKM MINISTRIES with enterprise-grade security</p>
          </div>

          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    step <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step < currentStep ? <CheckCircle className="w-5 h-5" /> : step}
                </div>
                {step < 3 && <div className={`w-12 h-1 mx-2 ${step < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />}
              </React.Fragment>
            ))}
          </div>

          <div className="flex justify-between text-xs text-gray-600 mb-8 px-2">
            <span className={currentStep >= 1 ? 'text-blue-600 font-medium' : ''}>Personal Info</span>
            <span className={currentStep >= 2 ? 'text-blue-600 font-medium' : ''}>Security</span>
            <span className={currentStep >= 3 ? 'text-blue-600 font-medium' : ''}>Terms</span>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {currentStep === 1 && (
              <RegistrationStepPersonal
                formData={formData}
                emailValid={emailValid}
                emailTouched={emailTouched}
                emailExists={emailExists}
                onChange={handleInputChange}
                onAvatarChange={handleAvatarChange}
                setEmailTouched={setEmailTouched}
              />
            )}

            {currentStep === 2 && (
              <RegistrationStepSecurity
                formData={formData}
                showPassword={showPassword}
                showConfirmPassword={showConfirmPassword}
                passwordCriteria={passwordCriteria}
                passwordsMatch={passwordsMatch}
                onChange={handleInputChange}
                setShowPassword={setShowPassword}
                setShowConfirmPassword={setShowConfirmPassword}
              />
            )}

            {currentStep === 3 && <RegistrationStepTerms formData={formData} onChange={handleInputChange} />}

            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
                >
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  Previous
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Back to Login
                </button>
              )}

              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors flex items-center shadow-md"
                >
                  Next
                  <ArrowRightIcon className="w-4 h-4 ml-2" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading || !validateStep(3)}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium text-sm rounded-lg transition-colors flex items-center shadow-md"
                >
                  {isLoading ? (
                    'Creating Account...'
                  ) : (
                    <>
                      Create Account
                      <UserPlusIcon className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseRegistration;
