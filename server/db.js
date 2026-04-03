'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'celeste.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Run a prepared statement and return all rows.
 * @param {string} sql
 * @param {any[]} params
 * @returns {any[]}
 */
function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

/**
 * Run a prepared statement and return the first row.
 * @param {string} sql
 * @param {any[]} params
 * @returns {any}
 */
function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

/**
 * Run a prepared statement (INSERT/UPDATE/DELETE).
 * @param {string} sql
 * @param {any[]} params
 * @returns {import('better-sqlite3').RunResult}
 */
function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

module.exports = { db, all, get, run };
