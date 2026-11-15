import '@testing-library/jest-dom'; 
import { vi, beforeEach, afterEach } from 'vitest'; 
const orig = console.error; 
beforeEach(() => { console.error = vi.fn(); }); 
afterEach(() => { console.error = orig; }); 





