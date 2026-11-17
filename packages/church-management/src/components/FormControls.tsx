import React from 'react';
import { ChevronDownIcon } from './Icons';

export const InputField: React.FC<{
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  icon?: React.ElementType;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ name, label, type, placeholder, icon: Icon, required, value, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      {Icon && (
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Icon className="h-5 w-5 text-gray-400" />
        </span>
      )}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        pattern={type === 'date' ? '\\d{4}-\\d{2}-\\d{2}' : undefined}
        className={`w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${Icon ? 'pl-10' : 'px-3'}`}
      />
    </div>
  </div>
);

export const SelectField: React.FC<{
  name: string;
  label: string;
  options: string[];
  disabledOptions?: string[];
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string;
}> = ({ name, label, options, disabledOptions = [], required, value, onChange, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        aria-label={label}
        className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none bg-white capitalize"
      >
        <option value="" disabled hidden>
          {placeholder || `Select ${label}`}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt} className="capitalize" disabled={disabledOptions.includes(opt)}>
            {opt}
          </option>
        ))}
      </select>
      <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
      </span>
    </div>
  </div>
);

export const TextAreaField: React.FC<{
  name?: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
}> = ({ name, label, placeholder, required, value, onChange, rows = 4 }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <textarea
      name={name}
      placeholder={placeholder}
      rows={rows}
      className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
      value={value}
      onChange={onChange}
      required={required}
    ></textarea>
  </div>
);
