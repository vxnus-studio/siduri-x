import fs from 'node:fs';
import path from 'node:path';

jest.mock('inquirer', () => ({
  prompt: jest.fn(),
  Separator: jest.fn((label) => ({ type: 'separator', line: label })),
}));

import { validateProjectDirectory, projectDirectoryName } from './index';

describe('Project Directory Validation & Handling', () => {
  test('rejects empty or whitespace-only directory names', () => {
    expect(validateProjectDirectory('')).toBe('Please enter a project directory.');
    expect(validateProjectDirectory('   ')).toBe('Please enter a project directory.');
  });

  test('rejects purely numeric directory names', () => {
    expect(validateProjectDirectory('123')).toBe('Project directory cannot be a number.');
    expect(validateProjectDirectory('0')).toBe('Project directory cannot be a number.');
    expect(validateProjectDirectory('42')).toBe('Project directory cannot be a number.');
    expect(validateProjectDirectory('999999')).toBe('Project directory cannot be a number.');
  });

  test('rejects directory names that already exist in cwd', () => {
    // 'src' definitely exists in cli working directory
    const result = validateProjectDirectory('src');
    expect(result).toBe('Directory "src" already exists in the current directory.');
  });

  test('accepts valid non-kebab-case directory names', () => {
    const nonExistentDir = 'CompanionTestDir_' + Date.now();
    expect(validateProjectDirectory(nonExistentDir)).toBe(true);

    const privateCompanion = 'PrivateCompanion_' + Date.now();
    expect(validateProjectDirectory(privateCompanion)).toBe(true);
  });

  test('projectDirectoryName preserves casing without forcing kebab-case', () => {
    expect(projectDirectoryName('Companion')).toBe('Companion');
    expect(projectDirectoryName('PrivateCompanion')).toBe('PrivateCompanion');
    expect(projectDirectoryName('MySpecialCompanion')).toBe('MySpecialCompanion');
    expect(projectDirectoryName('   TrimmedCompanion   ')).toBe('TrimmedCompanion');
    expect(projectDirectoryName('')).toBe('Companion');
  });
});
