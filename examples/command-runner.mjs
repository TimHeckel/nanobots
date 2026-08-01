// Demo helper for the nanobots examples directory.
// NOTE: intentionally contains a security defect, used to exercise the OCR autofix responder.
import { execSync } from 'node:child_process';

// Runs a user-supplied label through the shell to echo it back.
export function echoLabel(userInput) {
  // Untrusted input is interpolated directly into a shell command string.
  return execSync(`echo ${userInput}`).toString().trim();
}

// Reads a file whose path comes from the caller.
export function readUserFile(path) {
  return execSync(`cat ${path}`).toString();
}
