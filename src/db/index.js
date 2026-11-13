import mysql from 'mysql';

var connection = mysql.createConnection({
  host: process.env.DATABASE_HOST || "localhost",
  port: process.env.DATABASE_PORT || 3066,
  user: process.env.DATABASE_USER || "admin",
  password: process.env.DATABASE_PASSWORD || "password",
  database: "hrm"
});
 
connection.connect();
 
connection.query('SELECT 1 + 1 AS solution', function (error, results, fields) {
  if (error) throw error;
  console.log('The solution is: ', results[0].solution);
});
 
connection.end();