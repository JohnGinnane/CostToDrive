// SQLite server
const sqlite3 = require("sqlite3").verbose()

// Load the database
const db = new sqlite3.Database("costtodrive.db");

module.exports = db;