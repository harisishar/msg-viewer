# Testing Patterns

**Analysis Date:** 2026-04-01

## Test Framework

**Runner:**
- Not detected

**Assertion Library:**
- Not detected

**Run Commands:**
- No test scripts defined in package.json

**Analysis Note:**
No test framework, test runner, or test configuration detected. No `.test.ts`, `.spec.ts` files or test directories (`tests/`, `__tests__/`, `test/`) found in the codebase. The project has no Jest, Vitest, Mocha, or similar test infrastructure configured.

## Test File Organization

**Location:**
- Not applicable - no tests present

**Naming:**
- Not applicable - no tests present

**Structure:**
- Not applicable - no tests present

## Test Structure

**Suite Organization:**
Not applicable - no tests present

**Patterns:**
Not applicable - no tests present

## Mocking

**Framework:**
- Not detected

**Patterns:**
Not applicable - no tests present

**What to Mock:**
Not applicable - no tests present

**What NOT to Mock:**
Not applicable - no tests present

## Fixtures and Factories

**Test Data:**
Not applicable - no tests present

**Location:**
Not applicable - no tests present

## Coverage

**Requirements:**
- Not enforced

**View Coverage:**
Not applicable - no test suite exists

## Test Types

**Unit Tests:**
- Not present

**Integration Tests:**
- Not present

**E2E Tests:**
- Not present

## Common Patterns

Not applicable - no tests present

## Code Testability Observations

**Observable:**
- Code is mostly procedural with clear input/output patterns
- Heavy use of callbacks in `CompoundFile.readStream()` makes it difficult to test: `getDataAction: (offset: number, bytesToRead: number) => void`
- View model objects (`MessageViewModel`, `RecipientViewModel`, `AttachmentViewModel`) are simple data objects suitable for unit testing
- Component functions (`messageFragment()`, `attachmentsFragment()`, etc.) depend on DOM APIs (document.createElement, querySelector, addEventListener), making unit testing challenging without DOM mocking
- Parser functions (`parse()`, `parseDir()`) have clear inputs (DataView) and outputs (Message object), suitable for unit testing with test data files
- Binary format handling (`RTF decompression`, `compound file parsing`) would benefit from fixture files with known binary data and expected outputs

## Recommended Testing Strategy

For future test implementation:
- **Unit Tests:** Parser functions and data transformation functions (property types, property streams) using binary fixture files
- **Integration Tests:** End-to-end message parsing from .msg files
- **Component Tests:** View model creation and DOM fragment generation using jsdom or happy-dom
- **Fixtures:** Store sample .msg files and binary test data in `tests/fixtures/`

---

*Testing analysis: 2026-04-01*
