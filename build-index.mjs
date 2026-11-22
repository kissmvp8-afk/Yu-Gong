#!/usr/bin/env node
// The public module library's index builder and checker (this repository; its source is super-agent's module-library/;
// see README.md). No dependencies, no network.
//
//   node build-index.mjs            check every modules/*.json and write index.json
//   node build-index.mjs --check    check only (used on every pull request); exit 1 on the first problem
//
// A module file must be exactly what the Super Agent desktop app produces (desktop/src/library.js validatePackage): format 1, an id
// that is the sha256 of its content, safe relative paths, at most 200 files and 2 MB, and nothing that still looks like a key or a
// password (desktop/src/share.js leftovers). Its file name must be its id. index.json lists each module with the sha256 of its file,
// which the app checks before using it.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(ROOT, 'modules');
const LIMITS = { files: 200, bytes: 2 * 1024 * 1024, name: 60, summary: 300, tags: 8, tag: 20, criteria: 10, criterion: 300 };
const SECRETS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35})\b/,
  /(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|auth|密码)["']?\s*[:=]\s*["'](?!\[已隐藏\])[^"'\n]{4,}["']/i,
  /[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]+@/i,
];

const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'
    : JSON.stringify(value);
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

function fail(file, why) {
  console.error(file + ': ' + why);
  process.exit(1);
}

function text(file, value, limit, what) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u0008\u000b-\u001f]/.test(value)) fail(file, what + ' is not valid');
  return value;
}

function safe(rel) {
  if (typeof rel !== 'string' || !rel || rel.length > 1000 || rel.includes('\\') || rel.includes('\0') || rel.startsWith('/')) return false;
  return rel.split('/').every(p => p && p !== '.' && p !== '..' && !/^[A-Za-z]:/.test(p) && !/[<>:"|?*]/.test(p));
}

function check(name) {
  const file = path.join('modules', name);
  if (!/^m-[0-9a-f]{16}\.json$/.test(name)) fail(file, 'the file name must be the module id');
  const raw = fs.readFileSync(path.join(DIR, name));
  let pkg;
  try { pkg = JSON.parse(raw.toString('utf8')); } catch { fail(file, 'not JSON'); }
  if (!pkg || Object.keys(pkg).sort().join() !== 'criteria,files,format,id,name,summary,tags' || pkg.format !== 1) fail(file, 'not a module file');
  text(file, pkg.name, LIMITS.name, 'name');
  text(file, pkg.summary, LIMITS.summary, 'summary');
  if (!Array.isArray(pkg.tags) || pkg.tags.length > LIMITS.tags) fail(file, 'tags are not valid');
  pkg.tags.forEach(t => text(file, t, LIMITS.tag, 'a tag'));
  if (!Array.isArray(pkg.criteria) || pkg.criteria.length > LIMITS.criteria) fail(file, 'criteria are not valid');
  pkg.criteria.forEach(c => text(file, c, LIMITS.criterion, 'a criterion'));
  const names = pkg.files && typeof pkg.files === 'object' && !Array.isArray(pkg.files) ? Object.keys(pkg.files) : [];
  if (!names.length || names.length > LIMITS.files) fail(file, 'it must have 1 to 200 files');
  let total = 0;
  for (const rel of names) {
    const data = pkg.files[rel];
    if (!safe(rel) || typeof data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4) fail(file, 'unsafe file: ' + rel);
    const bytes = Buffer.from(data, 'base64');
    total += bytes.length;
    if (total > LIMITS.bytes) fail(file, 'larger than 2 MB');
    const content = bytes.toString('utf8');
    for (const re of SECRETS) if (re.test(content)) fail(file, rel + ' still contains something that looks like a key or a password');
  }
  const { format, name: title, summary, tags, criteria, files } = pkg;
  const id = 'm-' + sha256(canonical({ format, name: title, summary, tags, criteria, files })).slice(0, 16);
  if (pkg.id !== id || name !== id + '.json') fail(file, 'the id does not match the content');
  return { id, name: pkg.name, summary: pkg.summary, tags: pkg.tags, path: 'modules/' + name, sha256: sha256(raw) };
}

const names = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(n => !n.startsWith('.')).sort() : [];
const modules = names.map(check);
if (process.argv.includes('--check')) {
  console.log('ok: ' + modules.length + ' modules');
} else {
  fs.writeFileSync(path.join(ROOT, 'index.json'), JSON.stringify({ format: 1, modules }, null, 1) + '\n');
  console.log('index.json: ' + modules.length + ' modules');
}
